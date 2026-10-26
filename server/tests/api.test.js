import assert from 'node:assert/strict'
import test from 'node:test'
import express from 'express'
import { createAuthRouter } from '../routes/auth.js'
import { createPaymentsRouter } from '../routes/payments.js'
import { createWorkspaceRouter } from '../routes/workspace.js'
import { requireCsrfToken } from '../middleware/security.js'

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

test('workspace plan selection rejects unknown products before database access', async (t) => {
  const app = express()
  app.use(express.json())
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