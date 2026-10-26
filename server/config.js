import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().trim().optional(),
  SESSION_SECRET: z.string().optional(),
  FRONTEND_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
  SESSION_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  DATABASE_SSL: z.enum(['disable', 'require']).default('disable'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  APP_BASE_URL: z.string().url().default('http://localhost:5173'),
  CANDIDATE_RETENTION_DAYS: z.preprocess(
    (value) => value === '' ? undefined : value,
    z.coerce.number().int().min(1).max(3650).optional(),
  ),
})

const env = envSchema.parse(process.env)

export const config = {
  environment: env.NODE_ENV,
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  sessionSecret: env.SESSION_SECRET,
  frontendOrigins: new Set(env.FRONTEND_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)),
  sessionSameSite: env.SESSION_SAME_SITE,
  databaseSsl: env.DATABASE_SSL === 'require',
  resendApiKey: env.RESEND_API_KEY,
  emailFrom: env.EMAIL_FROM,
  appBaseUrl: env.APP_BASE_URL.replace(/\/$/, ''),
  emailVerificationEnabled: Boolean(env.RESEND_API_KEY && env.EMAIL_FROM),
  candidateRetentionDays: env.CANDIDATE_RETENTION_DAYS,
}

export function assertServerConfig() {
  const missing = []
  if (!config.databaseUrl) missing.push('DATABASE_URL')
  if (!config.sessionSecret || config.sessionSecret.length < 32 || config.sessionSecret.startsWith('REPLACE_')) {
    missing.push('SESSION_SECRET (a random value of at least 32 characters)')
  }
  if (config.environment === 'production' && config.sessionSameSite !== 'none') {
    throw new Error('Set SESSION_SAME_SITE=none for cross-site frontend/backend deployments over HTTPS.')
  }
  if (missing.length) throw new Error(`Missing required server configuration: ${missing.join(', ')}`)
}