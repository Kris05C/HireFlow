import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { config } from '../config.js'
import { logger } from '../observability.js'

const scrypt = promisify(scryptCallback)
const registrationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
  workspaceName: z.string().trim().min(1).max(120),
}).strict()
const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
}).strict()
const resendSchema = z.object({ email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()) }).strict()
const verificationSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).strict()
const passwordResetRequestSchema = z.object({ email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()) }).strict()
const passwordResetSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  password: z.string().min(12).max(128),
}).strict()
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false })
const resendLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 3, standardHeaders: true, legacyHeaders: false })
const passwordResetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false })

const hashVerificationToken = (token) => createHash('sha256').update(token).digest('hex')

async function sendVerificationEmail(email, name, token) {
  if (!config.emailVerificationEnabled) return false
  const verifyUrl = `${config.appBaseUrl}/verify-email?token=${encodeURIComponent(token)}`
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.emailFrom,
      to: [email],
      subject: 'Verify your HireFlow email address',
      text: `Hello ${name},\n\nVerify your HireFlow email address using this link (valid for 24 hours):\n${verifyUrl}\n\nIf you did not create this account, ignore this message.`,
    }),
  })
  return response.ok
}

async function sendPasswordResetEmail(email, name, token) {
  if (!config.emailVerificationEnabled) return false
  const resetUrl = `${config.appBaseUrl}/reset-password?token=${encodeURIComponent(token)}`
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.emailFrom,
      to: [email],
      subject: 'Reset your HireFlow password',
      text: `Hello ${name},\n\nReset your HireFlow password using this link (valid for 1 hour):\n${resetUrl}\n\nIf you did not request this, ignore this message.`,
    }),
  })
  return response.ok
}

async function hashPassword(password) {
  const salt = randomBytes(16)
  const derivedKey = await scrypt(password, salt, 64)
  return `scrypt$${salt.toString('hex')}$${derivedKey.toString('hex')}`
}

async function verifyPassword(password, storedHash) {
  const [algorithm, saltHex, keyHex] = storedHash.split('$')
  if (algorithm !== 'scrypt' || !saltHex || !keyHex) return false
  const expectedKey = Buffer.from(keyHex, 'hex')
  const actualKey = await scrypt(password, Buffer.from(saltHex, 'hex'), expectedKey.length)
  return actualKey.length === expectedKey.length && timingSafeEqual(actualKey, expectedKey)
}

function validationError(res, error) {
  return res.status(400).json({
    error: 'Check the submitted information and try again.',
    code: 'VALIDATION_ERROR',
    fields: error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
  })
}

function regenerateSession(req, userId, emailVerified) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) return reject(error)
      req.session.userId = userId
      req.session.emailVerified = emailVerified
      req.session.csrfToken = randomBytes(32).toString('hex')
      req.session.save((saveError) => saveError ? reject(saveError) : resolve(req.session.csrfToken))
    })
  })
}

export function createAuthRouter(databasePool) {
  const router = Router()

  router.get('/csrf', (req, res) => {
    if (!req.session.csrfToken) req.session.csrfToken = randomBytes(32).toString('hex')
    res.set('Cache-Control', 'no-store')
    return res.json({ csrfToken: req.session.csrfToken })
  })

  router.get('/me', async (req, res, next) => {
    if (!req.session.userId) return res.json({ user: null, workspace: null })
    try {
      const result = await databasePool.query(
        `SELECT u.id, u.email, u.full_name, u.job_title, u.email_verified_at,
                w.id AS workspace_id, w.name AS workspace_name, m.role
         FROM users u
         JOIN workspace_memberships m ON m.user_id = u.id AND m.status = 'active'
         JOIN workspaces w ON w.id = m.workspace_id
         WHERE u.id = $1
         ORDER BY m.created_at ASC
         LIMIT 1`,
        [req.session.userId],
      )
      if (!result.rowCount) return res.status(401).json({ user: null, workspace: null })
      const record = result.rows[0]
      return res.json({
        user: { id: record.id, email: record.email, name: record.full_name, role: record.job_title, emailVerified: Boolean(record.email_verified_at) },
        workspace: { id: record.workspace_id, name: record.workspace_name, role: record.role },
      })
    } catch (error) {
      return next(error)
    }
  })

  router.post('/verify-email', authLimiter, async (req, res, next) => {
    const parsed = verificationSchema.safeParse(req.body)
    if (!parsed.success) return validationError(res, parsed.error)
    const client = await databasePool.connect().catch(next)
    if (!client) return
    try {
      await client.query('BEGIN')
      const result = await client.query(
        `UPDATE users u SET email_verified_at = now(), updated_at = now()
         FROM email_verification_tokens t
         WHERE t.user_id = u.id AND t.token_hash = $1 AND t.expires_at > now() AND t.consumed_at IS NULL
         RETURNING u.id`,
        [hashVerificationToken(parsed.data.token)],
      )
      if (!result.rowCount) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: 'This verification link is invalid or expired. Request a new one.', code: 'VERIFICATION_LINK_INVALID' })
      }
      await client.query('UPDATE email_verification_tokens SET consumed_at = now() WHERE user_id = $1', [result.rows[0].id])
      await client.query('COMMIT')
      return res.json({ verified: true })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      return next(error)
    } finally {
      client.release()
    }
  })

  router.post('/verification/resend', resendLimiter, async (req, res, next) => {
    const parsed = resendSchema.safeParse(req.body)
    if (!parsed.success) return validationError(res, parsed.error)
    if (!config.emailVerificationEnabled) return res.status(503).json({ error: 'Email verification delivery is not configured.', code: 'EMAIL_NOT_CONFIGURED' })
    try {
      const result = await databasePool.query(
        'SELECT id, full_name FROM users WHERE email = $1 AND email_verified_at IS NULL',
        [parsed.data.email],
      )
      if (result.rowCount) {
        const token = randomBytes(32).toString('hex')
        await databasePool.query(
          `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
           VALUES ($1, $2, now() + interval '24 hours')
           ON CONFLICT (user_id) DO UPDATE
           SET token_hash = EXCLUDED.token_hash, expires_at = EXCLUDED.expires_at, consumed_at = NULL, created_at = now()`,
          [result.rows[0].id, hashVerificationToken(token)],
        )
        const delivered = await sendVerificationEmail(parsed.data.email, result.rows[0].full_name, token)
        if (!delivered) logger.error('Verification email delivery was not accepted by the provider.')
      }
      return res.status(202).json({ notice: 'If the account exists and needs verification, delivery will be attempted. Check your email or retry later.' })
    } catch (error) {
      return next(error)
    }
  })

  router.post('/password-reset/request', passwordResetLimiter, async (req, res, next) => {
    const parsed = passwordResetRequestSchema.safeParse(req.body)
    if (!parsed.success) return validationError(res, parsed.error)
    if (!config.emailVerificationEnabled) return res.status(503).json({ error: 'Password recovery is not configured because email delivery is unavailable.', code: 'EMAIL_NOT_CONFIGURED' })
    try {
      const result = await databasePool.query('SELECT id, full_name FROM users WHERE email = $1', [parsed.data.email])
      if (result.rowCount) {
        const token = randomBytes(32).toString('hex')
        await databasePool.query(
          `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
           VALUES ($1, $2, now() + interval '1 hour')
           ON CONFLICT (user_id) DO UPDATE
           SET token_hash = EXCLUDED.token_hash, expires_at = EXCLUDED.expires_at, consumed_at = NULL, created_at = now()`,
          [result.rows[0].id, hashVerificationToken(token)],
        )
        const delivered = await sendPasswordResetEmail(parsed.data.email, result.rows[0].full_name, token)
        if (!delivered) logger.error('Password reset email delivery was not accepted by the provider.')
      }
      return res.status(202).json({ notice: 'If an account exists for this email, password recovery instructions will be sent.' })
    } catch (error) {
      return next(error)
    }
  })

  router.post('/password-reset/complete', passwordResetLimiter, async (req, res, next) => {
    const parsed = passwordResetSchema.safeParse(req.body)
    if (!parsed.success) return validationError(res, parsed.error)
    let client
    try {
      const passwordHash = await hashPassword(parsed.data.password)
      client = await databasePool.connect()
      await client.query('BEGIN')
      const result = await client.query(
        `UPDATE users u SET password_hash = $1, updated_at = now()
         FROM password_reset_tokens t
         WHERE t.user_id = u.id AND t.token_hash = $2 AND t.expires_at > now() AND t.consumed_at IS NULL
         RETURNING u.id`,
        [passwordHash, hashVerificationToken(parsed.data.token)],
      )
      if (!result.rowCount) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: 'This password reset link is invalid or expired. Request a new one.', code: 'PASSWORD_RESET_INVALID' })
      }
      await client.query('UPDATE password_reset_tokens SET consumed_at = now() WHERE user_id = $1', [result.rows[0].id])
      await client.query(`DELETE FROM user_sessions WHERE sess->>'userId' = $1`, [result.rows[0].id])
      await client.query('COMMIT')
      return res.json({ reset: true })
    } catch (error) {
      await client?.query('ROLLBACK').catch(() => {})
      return next(error)
    } finally {
      client?.release()
    }
  })

  router.post('/register', authLimiter, async (req, res, next) => {
    const parsed = registrationSchema.safeParse(req.body)
    if (!parsed.success) return validationError(res, parsed.error)
    if (!config.emailVerificationEnabled) return res.status(503).json({ error: 'Account registration is unavailable until email verification delivery is configured.', code: 'EMAIL_NOT_CONFIGURED' })
    const { name, email, password, workspaceName } = parsed.data
    const userId = randomUUID()
    const workspaceId = randomUUID()
    const verificationToken = randomBytes(32).toString('hex')
    let client
    try {
      const passwordHash = await hashPassword(password)
      client = await databasePool.connect()
      await client.query('BEGIN')
      await client.query(
        'INSERT INTO users (id, email, password_hash, full_name) VALUES ($1, $2, $3, $4)',
        [userId, email, passwordHash, name],
      )
      await client.query('INSERT INTO workspaces (id, name) VALUES ($1, $2)', [workspaceId, workspaceName])
      await client.query(
        'INSERT INTO workspace_memberships (workspace_id, user_id, role) VALUES ($1, $2, $3)',
        [workspaceId, userId, 'owner'],
      )
      await client.query(
        'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval \'24 hours\')',
        [userId, hashVerificationToken(verificationToken)],
      )
      await client.query('COMMIT')
      client.release()
      client = null
      let emailSent = false
      try {
        emailSent = await sendVerificationEmail(email, name, verificationToken)
      } catch {
        emailSent = false
      }
      if (!emailSent) return res.status(503).json({ error: 'Email verification could not be delivered. Request a new verification email later.', code: 'EMAIL_DELIVERY_FAILED' })
      return res.status(201).json({
        user: { id: userId, email, name, emailVerified: false },
        workspace: { id: workspaceId, name: workspaceName, role: 'owner' },
        notice: 'Account created. Check your email to verify it before signing in.',
      })
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {})
      if (error.code === '23505') return res.status(409).json({ error: 'An account already exists for this email address.', code: 'EMAIL_IN_USE' })
      return next(error)
    } finally {
      client?.release()
    }
  })

  router.post('/login', authLimiter, async (req, res, next) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) return validationError(res, parsed.error)
    try {
      const result = await databasePool.query(
        'SELECT id, email, full_name, job_title, password_hash, email_verified_at FROM users WHERE email = $1',
        [parsed.data.email],
      )
      const user = result.rows[0]
      if (!user || !(await verifyPassword(parsed.data.password, user.password_hash))) {
        return res.status(401).json({ error: 'Email or password is incorrect.', code: 'INVALID_CREDENTIALS' })
      }
      if (!user.email_verified_at) return res.status(403).json({ error: 'Verify your email address before signing in.', code: 'EMAIL_VERIFICATION_REQUIRED' })
      const csrfToken = await regenerateSession(req, user.id, true)
      return res.json({ user: { id: user.id, email: user.email, name: user.full_name, role: user.job_title, emailVerified: true }, csrfToken })
    } catch (error) {
      return next(error)
    }
  })

  router.post('/logout', (req, res, next) => {
    req.session.destroy((error) => {
      if (error) return next(error)
      res.clearCookie('hireflow.sid', { httpOnly: true, sameSite: config.sessionSameSite, secure: config.environment === 'production', path: '/' })
      return res.status(204).end()
    })
  })

  return router
}