import connectPgSimple from 'connect-pg-simple'
import cors from 'cors'
import express from 'express'
import session from 'express-session'
import helmet from 'helmet'
import { config } from './config.js'
import { createAuthRouter } from './routes/auth.js'
import { createJobsRouter } from './routes/jobs.js'
import { createPaymentsRouter } from './routes/payments.js'
import { createWorkspaceRouter } from './routes/workspace.js'
import { createOutreachRouter } from './routes/outreach.js'
import { requireAuth, requireCsrfToken, requireWorkspace } from './middleware/security.js'
import { logger, requestIdMiddleware } from './observability.js'

const PgSessionStore = connectPgSimple(session)

export function createApp(databasePool) {
  const app = express()
  app.use(requestIdMiddleware)
  if (config.environment === 'production') app.set('trust proxy', 1)
  app.disable('x-powered-by')
  app.use(helmet())
  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.frontendOrigins.has(origin)) return callback(null, true)
      return callback(new Error('Origin is not allowed.'))
    },
    credentials: true,
  }))
  app.use(express.json({ limit: '1mb', strict: true }))
  app.use(session({
    name: 'hireflow.sid',
    secret: config.sessionSecret,
    store: new PgSessionStore({ pool: databasePool, tableName: 'user_sessions', createTableIfMissing: false }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.environment === 'production',
      sameSite: config.sessionSameSite,
      maxAge: 8 * 60 * 60 * 1000,
      path: '/',
    },
  }))
  app.use('/api', requireCsrfToken)
  app.get('/api/health', async (_req, res, next) => {
    try {
      await databasePool.query('SELECT 1')
      return res.json({ status: 'ok', database: 'connected' })
    } catch (error) {
      return next(error)
    }
  })
  app.use('/api/auth', createAuthRouter(databasePool))
  app.use('/api/outreach', createOutreachRouter(databasePool))
  app.use('/api/workspace', requireAuth, requireWorkspace(databasePool), createWorkspaceRouter(databasePool))
  app.use('/api/jobs', requireAuth, requireWorkspace(databasePool), createJobsRouter(databasePool))
  app.use('/api/payments', requireAuth, requireWorkspace(databasePool), createPaymentsRouter())
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.', code: 'NOT_FOUND' }))
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error)
    if (error.message === 'Origin is not allowed.') return res.status(403).json({ error: error.message, code: 'ORIGIN_NOT_ALLOWED' })
    logger.error('API request failed', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      errorName: error.name,
      errorCode: error.code,
    })
    return res.status(500).json({ error: 'The server could not complete this request.', code: 'INTERNAL_ERROR' })
  })
  return app
}