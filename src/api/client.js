const apiBaseUrl = (import.meta.env?.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
let csrfToken = ''

async function parseResponse(response) {
  if (response.status === 204) return null
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.error || 'The request could not be completed.')
    error.code = payload.code || 'REQUEST_FAILED'
    error.status = response.status
    error.fields = payload.fields || []
    error.requestId = response.headers?.get?.('X-Request-ID') || ''
    throw error
  }
  return payload
}

async function refreshCsrfToken() {
  const response = await fetch(`${apiBaseUrl}/auth/csrf`, { credentials: 'include', cache: 'no-store' })
  const payload = await parseResponse(response)
  csrfToken = payload.csrfToken
  return csrfToken
}

export async function apiRequest(path, options = {}) {
  const { method = 'GET', body, headers = {} } = options
  const upperMethod = method.toUpperCase()
  if (!['GET', 'HEAD', 'OPTIONS'].includes(upperMethod) && !csrfToken) await refreshCsrfToken()
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: upperMethod,
      credentials: 'include',
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(!['GET', 'HEAD', 'OPTIONS'].includes(upperMethod) ? { 'X-CSRF-Token': csrfToken } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const payload = await parseResponse(response)
    if (payload?.csrfToken) csrfToken = payload.csrfToken
    return payload
  } catch (error) {
    const csrfFailure = error.code === 'CSRF_TOKEN_REQUIRED' || error.code === 'CSRF_TOKEN_INVALID'
    if (!csrfFailure || ['GET', 'HEAD', 'OPTIONS'].includes(upperMethod) || options._csrfRetried) throw error
    csrfToken = ''
    await refreshCsrfToken()
    return apiRequest(path, { ...options, _csrfRetried: true })
  }
}

export function clearCsrfToken() {
  csrfToken = ''
}