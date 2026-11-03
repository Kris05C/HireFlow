import pg from 'pg'
import { config } from '../config.js'
import { logger } from '../observability.js'

const { Pool } = pg

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: true } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

pool.on('error', () => {
  logger.error('Unexpected PostgreSQL pool error')
})