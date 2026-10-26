import { timingSafeEqual } from 'node:crypto'

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])

export function requireCsrfToken(req, res, next) {
  if (safeMethods.has(req.method)) return next()

  const expected = req.session?.csrfToken
  const received = req.get('x-csrf-token')
  if (!expected || !received) return res.status(403).json({ error: 'Refresh the page and retry this request.', code: 'CSRF_TOKEN_REQUIRED' })

  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(received)
  if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
    return res.status(403).json({ error: 'Refresh the page and retry this request.', code: 'CSRF_TOKEN_INVALID' })
  }
  return next()
}

export function requireAuth(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: 'Sign in to continue.', code: 'AUTH_REQUIRED' })
  if (req.session.emailVerified !== true) return res.status(403).json({ error: 'Verify your email address before accessing workspace data.', code: 'EMAIL_VERIFICATION_REQUIRED' })
  return next()
}

export function requireWorkspace(databasePool) {
  return async (req, res, next) => {
    try {
      const result = await databasePool.query(
        `SELECT workspace_id, role
         FROM workspace_memberships
         WHERE user_id = $1 AND status = 'active'
         ORDER BY created_at ASC
         LIMIT 1`,
        [req.session.userId],
      )
      if (!result.rowCount) return res.status(403).json({ error: 'No active workspace is assigned to this account.', code: 'WORKSPACE_REQUIRED' })
      req.workspaceId = result.rows[0].workspace_id
      req.workspaceRole = result.rows[0].role
      return next()
    } catch {
      return next(new Error('Workspace authorization failed.'))
    }
  }
}