import assert from 'node:assert/strict'
import test from 'node:test'
import { apiRequest, clearCsrfToken } from './client.js'

function response(status, payload) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => payload,
  }
}

test('API client sends safe requests without a CSRF preflight', async () => {
  const calls = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return response(200, { jobs: [] })
  }
  try {
    clearCsrfToken()
    const result = await apiRequest('/jobs')
    assert.deepEqual(result, { jobs: [] })
    assert.equal(calls.length, 1)
    assert.equal(calls[0].options.credentials, 'include')
    assert.equal(calls[0].options.headers['X-CSRF-Token'], undefined)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('API client refreshes CSRF before unsafe requests and serializes JSON', async () => {
  const calls = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    if (url.endsWith('/auth/csrf')) return response(200, { csrfToken: 'csrf-token' })
    return response(201, { saved: true })
  }
  try {
    clearCsrfToken()
    const result = await apiRequest('/jobs', { method: 'POST', body: { title: 'Engineer' } })
    assert.deepEqual(result, { saved: true })
    assert.equal(calls.length, 2)
    assert.equal(calls[1].options.headers['Content-Type'], 'application/json')
    assert.equal(calls[1].options.headers['X-CSRF-Token'], 'csrf-token')
    assert.equal(calls[1].options.body, JSON.stringify({ title: 'Engineer' }))
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('API client retries an unsafe request once after CSRF rejection', async () => {
  const calls = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    if (url.endsWith('/auth/csrf')) {
      return response(200, { csrfToken: calls.length === 1 ? 'stale-token' : 'fresh-token' })
    }
    if (calls.length === 2) return response(403, { code: 'CSRF_TOKEN_INVALID', error: 'Refresh token' })
    return response(200, { updated: true })
  }
  try {
    clearCsrfToken()
    const result = await apiRequest('/jobs/1', { method: 'PATCH', body: { status: 'Closed' } })
    assert.deepEqual(result, { updated: true })
    assert.equal(calls.length, 4)
    assert.equal(calls[1].options.headers['X-CSRF-Token'], 'stale-token')
    assert.equal(calls[3].options.headers['X-CSRF-Token'], 'fresh-token')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('API client exposes structured API errors', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => response(422, {
    code: 'VALIDATION_ERROR',
    error: 'Invalid input',
    fields: [{ field: 'title', message: 'Required' }],
  })
  try {
    await assert.rejects(
      apiRequest('/jobs'),
      (error) => error.code === 'VALIDATION_ERROR'
        && error.status === 422
        && error.fields[0].field === 'title',
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})
