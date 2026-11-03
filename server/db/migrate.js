import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { assertServerConfig } from '../config.js'
import { pool } from './pool.js'
import { logger } from '../observability.js'

assertServerConfig()

const migrationsUrl = new URL('./migrations/', import.meta.url)
const migrationFiles = (await readdir(migrationsUrl))
  .filter((name) => /^\d+_.+\.sql$/.test(name))
  .sort()
const client = await pool.connect()

try {
  await client.query('BEGIN')
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`)
  let appliedCount = 0
  for (const migrationName of migrationFiles) {
    const existing = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [migrationName])
    if (existing.rowCount) continue
    const migrationSql = await readFile(fileURLToPath(new URL(migrationName, migrationsUrl)), 'utf8')
    await client.query(migrationSql)
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migrationName])
    appliedCount += 1
  }
  await client.query('COMMIT')
  logger.info(appliedCount ? 'Applied database migrations' : 'Database schema is up to date', { appliedCount })
} catch {
  await client.query('ROLLBACK')
  logger.error('Database migration failed. Review the migration error without sharing credentials.')
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}