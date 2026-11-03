import assert from 'node:assert/strict'
import test from 'node:test'
import express from 'express'
import { createAuthRouter } from '../routes/auth.js'
import { createPaymentsRouter } from '../routes/payments.js'
import { createWorkspaceRouter } from '../routes/workspace.js'
import { createOutreachRouter } from '../routes/outreach.js'
import { requireCsrfToken, requireWorkspaceRole } from '../middleware/security.js'
import { createLogger, requestIdMiddleware } from '../observability.js'

test('request IDs are generated and returned without trusting client input', async (t) => {
  const app = express()
  app.use(requestIdMiddleware)
  app.get('/request-id', (req, res) => res.json({ requestId: req.requestId }))
  const baseUrl = await withServer(t, app)
  const response = await fetch(`${baseUrl}/request-id`, { headers: { 'X-Request-ID': 'client-supplied' } })
  const requestId = response.headers.get('X-Request-ID')
  assert.match(requestId, /^[0-9a-f-]{36}$/)
  assert.deepEqual((await response.json()).requestId, requestId)
  assert.notEqual(requestId, 'client-supplied')
})

test('structured logger redacts sensitive fields', () => {
  const entries = []
  const logger = createLogger({ info: (entry) => entries.push(entry), error: (entry) => entries.push(entry) })
  logger.error('test failure', { requestId: 'request-id', password: 'secret', nested: { apiKey: 'secret' } })
  const entry = JSON.parse(entries[0])
  assert.equal(entry.password, '[REDACTED]')
  assert.equal(entry.nested.apiKey, '[REDACTED]')
  assert.equal(entry.requestId, 'request-id')
})

async function withServer(t, app) {
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())))
  return `http://127.0.0.1:${server.address().port}`
}

test('registration rejects invalid input before contacting the database', async (t) => {
  const app = express()
  app.use(express.json())
  app.use('/auth', createAuthRouter({}))
  const baseUrl = await withServer(t, app)
  const response = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-email', password: 'short' }),
  })
  assert.equal(response.status, 400)
  assert.equal((await response.json()).code, 'VALIDATION_ERROR')
})

test('password recovery validates reset requests before contacting the database', async (t) => {
  const app = express()
  app.use(express.json())
  app.use('/auth', createAuthRouter({}))
  const baseUrl = await withServer(t, app)
  const requestResponse = await fetch(`${baseUrl}/auth/password-reset/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-email' }),
  })
  assert.equal(requestResponse.status, 400)
  assert.equal((await requestResponse.json()).code, 'VALIDATION_ERROR')

  const completeResponse = await fetch(`${baseUrl}/auth/password-reset/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'invalid', password: 'short' }),
  })
  assert.equal(completeResponse.status, 400)
  assert.equal((await completeResponse.json()).code, 'VALIDATION_ERROR')
})

test('workspace plan selection rejects unknown products before database access', async (t) => {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => { req.workspaceRole = 'owner'; next() })
  app.use('/workspace', createWorkspaceRouter({}))
  const baseUrl = await withServer(t, app)
  const response = await fetch(`${baseUrl}/workspace/plan-selection`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 'browser-submitted-price' }),
  })
  assert.equal(response.status, 400)
  assert.equal((await response.json()).code, 'UNKNOWN_PRODUCT')
})

test('candidate creation requires discovery consent and separate consent for email outreach', async (t) => {
  const app = express()
  app.use(express.json())
  app.use('/workspace', createWorkspaceRouter({}))
  const baseUrl = await withServer(t, app)
  const missingDiscoveryConsent = await fetch(`${baseUrl}/workspace/candidates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Candidate', role: 'Engineer', location: 'Remote', source: 'candidate-consented-recruiter-entry', discoveryConsent: false }),
  })
  assert.equal(missingDiscoveryConsent.status, 400)
  assert.equal((await missingDiscoveryConsent.json()).code, 'VALIDATION_ERROR')

  const outreachWithoutEmail = await fetch(`${baseUrl}/workspace/candidates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Candidate', role: 'Engineer', location: 'Remote', source: 'candidate-consented-recruiter-entry', discoveryConsent: true, outreachConsent: true }),
  })
  assert.equal(outreachWithoutEmail.status, 400)
  assert.equal((await outreachWithoutEmail.json()).code, 'VALIDATION_ERROR')
})

test('candidate deletion requires explicit confirmation before database access', async (t) => {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => { req.workspaceRole = 'admin'; next() })
  app.use('/workspace', createWorkspaceRouter({}))
  const baseUrl = await withServer(t, app)
  const response = await fetch(`${baseUrl}/workspace/candidates/not-a-uuid`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: false }),
  })
  assert.equal(response.status, 400)
  assert.equal((await response.json()).code, 'DELETION_CONFIRMATION_REQUIRED')
})

test('candidate organization endpoints validate identifiers and payloads before database access', async (t) => {
  const app = express()
  app.use(express.json())
  app.use('/workspace', createWorkspaceRouter({}))
  const baseUrl = await withServer(t, app)
  const folder = await fetch(`${baseUrl}/workspace/candidate-folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '' }),
  })
  assert.equal(folder.status, 400)
  assert.equal((await folder.json()).code, 'VALIDATION_ERROR')

  const status = await fetch(`${baseUrl}/workspace/candidates/not-a-uuid/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Unknown' }),
  })
  assert.equal(status.status, 400)
  assert.equal((await status.json()).code, 'VALIDATION_ERROR')
})

test('outreach template endpoints validate content before database access', async (t) => {
  const app = express()
  app.use(express.json())
  app.use('/workspace', createWorkspaceRouter({}))
  const baseUrl = await withServer(t, app)
  const response = await fetch(`${baseUrl}/workspace/outreach-templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '', subject: '', body: '' }),
  })

  assert.equal(response.status, 400)
  assert.equal((await response.json()).code, 'VALIDATION_ERROR')
})

test('campaign queue requires an authorized role and a valid idempotency key', async (t) => {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.workspaceRole = 'recruiter'
    req.workspaceId = 'workspace-id'
    req.session = { userId: 'user-id' }
    next()
  })

  app.use('/workspace', createWorkspaceRouter({}))
  const baseUrl = await withServer(t, app)
  const unauthorized = await fetch(`${baseUrl}/workspace/campaigns/00000000-0000-0000-0000-000000000000/queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idempotencyKey: 'short' }),
  })
  assert.equal(unauthorized.status, 403)
  assert.equal((await unauthorized.json()).code, 'WORKSPACE_PERMISSION_REQUIRED')

  const invalid = await fetch(`${baseUrl}/workspace/campaigns/not-a-uuid/queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idempotencyKey: 'valid-idempotency-key' }),
  })
  assert.equal(invalid.status, 403)
})

test('campaign queue validates selected recipient identifiers before database access', async (t) => {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.workspaceRole = 'owner'
    next()
  })
  app.use('/workspace', createWorkspaceRouter({}))
  const baseUrl = await withServer(t, app)
  const response = await fetch(`${baseUrl}/workspace/campaigns/00000000-0000-0000-0000-000000000000/queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idempotencyKey: 'valid-idempotency-key', candidateIds: ['not-a-uuid'] }),
  })
  assert.equal(response.status, 400)
  assert.equal((await response.json()).code, 'VALIDATION_ERROR')
})

test('unsubscribe endpoint rejects malformed tokens before database access', async (t) => {
  const app = express()
  app.use('/outreach', createOutreachRouter({}))
  const baseUrl = await withServer(t, app)
  const response = await fetch(`${baseUrl}/outreach/unsubscribe/not-a-token`)
  assert.equal(response.status, 400)
  assert.equal((await response.json()).code, 'INVALID_UNSUBSCRIBE_TOKEN')
})
test('PhonePe endpoints fail closed instead of reporting an unverified payment', async (t) => {
  const app = express()
  app.use('/payments', createPaymentsRouter())
  const baseUrl = await withServer(t, app)
  const response = await fetch(`${baseUrl}/payments/orders`, { method: 'POST' })
  assert.equal(response.status, 503)
  const body = await response.json()
  assert.equal(body.code, 'PAYMENTS_NOT_CONFIGURED')
  assert.match(body.error, /No payment has been initiated/)
})

test('CSRF middleware rejects unsafe requests without a session token', async (t) => {
  const app = express()
  app.use((req, _res, next) => { req.session = {}; next() })
  app.post('/write', requireCsrfToken, (_req, res) => res.status(204).end())
  const baseUrl = await withServer(t, app)
  const response = await fetch(`${baseUrl}/write`, { method: 'POST' })
  assert.equal(response.status, 403)
  assert.equal((await response.json()).code, 'CSRF_TOKEN_REQUIRED')
})

test('workspace role middleware allows admins and rejects recruiters for protected actions', async (t) => {
  const app = express()
  app.use('/admin-action', (req, _res, next) => {
    req.workspaceRole = req.get('x-workspace-role')
    next()
  }, requireWorkspaceRole('owner', 'admin'), (_req, res) => res.status(204).end())
  const baseUrl = await withServer(t, app)

  const allowed = await fetch(`${baseUrl}/admin-action`, { headers: { 'x-workspace-role': 'admin' } })
  assert.equal(allowed.status, 204)

  const denied = await fetch(`${baseUrl}/admin-action`, { headers: { 'x-workspace-role': 'recruiter' } })
  assert.equal(denied.status, 403)
  assert.equal((await denied.json()).code, 'WORKSPACE_PERMISSION_REQUIRED')
})