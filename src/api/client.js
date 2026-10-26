const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
let csrfToken = ''

async function parseResponse(response) {
  if (response.status === 204) return null
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.error || 'The request could not be completed.')
    error.code = payload.code || 'REQUEST_FAILED'
    error.status = response.status
    error.fields = payload.fields || []
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

export async function apiRequest(path, { method = 'GET', body, headers = {} } = {}) {
  const upperMethod = method.toUpperCase()
  if (!['GET', 'HEAD', 'OPTIONS'].includes(upperMethod) && !csrfToken) await refreshCsrfToken()
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
}

export function clearCsrfToken() {
  csrfToken = ''
}