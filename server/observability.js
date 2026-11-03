import { randomUUID } from 'node:crypto'

const sensitiveKey = /token|secret|password|authorization|cookie|api[-_]?key|email/i

function redact(value, key = '') {
  if (sensitiveKey.test(key)) return '[REDACTED]'
  if (Array.isArray(value)) return value.map((item) => redact(item))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, redact(childValue, childKey)]))
  }
  return value
}

export function createLogger(output = console) {
  const write = (level, message, context = {}) => {
    const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...redact(context) })
    output[level === 'error' ? 'error' : 'info'](entry)
  }
  return {
    info: (message, context) => write('info', message, context),
    error: (message, context) => write('error', message, context),
  }
}

export const logger = createLogger()

export function requestIdMiddleware(req, res, next) {
  const requestId = randomUUID()
  req.requestId = requestId
  res.setHeader('X-Request-ID', requestId)
  return next()
}
