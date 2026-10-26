import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { assertServerConfig } from '../config.js'
import { pool } from './pool.js'

assertServerConfig()

const migrationPath = fileURLToPath(new URL('./migrations/001_initial_schema.sql', import.meta.url))
const migrationSql = await readFile(migrationPath, 'utf8')
const client = await pool.connect()

try {
  await client.query('BEGIN')
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`)
  const existing = await client.query('SELECT name FROM schema_migrations WHERE name = $1', ['001_initial_schema.sql'])
  if (existing.rowCount === 0) {
    await client.query(migrationSql)
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', ['001_initial_schema.sql'])
  }
  await client.query('COMMIT')
  console.info(existing.rowCount ? 'Database schema is up to date.' : 'Database migration applied.')
} catch {
  await client.query('ROLLBACK')
  console.error('Database migration failed. Review the migration error without sharing credentials.')
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}