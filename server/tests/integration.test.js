import assert from 'node:assert/strict'
import test from 'node:test'
import pg from 'pg'
import { randomUUID } from 'node:crypto'

const integrationDatabaseUrl = process.env.INTEGRATION_DATABASE_URL || ''
const integrationDatabaseName = (() => {
  try {
    return new URL(integrationDatabaseUrl).pathname.replace(/^\/+/, '')
  } catch {
    return ''
  }
})()
const integrationEnabled = process.env.RUN_DB_INTEGRATION_TESTS === 'true'
  && process.env.NODE_ENV === 'test'
  && Boolean(integrationDatabaseUrl)
  && /(?:test|integration|ci)/i.test(integrationDatabaseName)

test('PostgreSQL integration environment is explicitly configured', { skip: !integrationEnabled }, async (t) => {
  const pool = new pg.Pool({
    connectionString: integrationDatabaseUrl,
    ssl: process.env.DATABASE_SSL === 'require' ? { rejectUnauthorized: false } : undefined,
  })
  t.after(() => pool.end())
  const result = await pool.query('SELECT current_database() AS database_name, current_user AS database_user')
  assert.ok(result.rows[0].database_name)
  assert.ok(result.rows[0].database_user)
})

test('PostgreSQL schema supports workspace isolation and duplicate prevention', { skip: !integrationEnabled }, async (t) => {
  const pool = new pg.Pool({
    connectionString: integrationDatabaseUrl,
    ssl: process.env.DATABASE_SSL === 'require' ? { rejectUnauthorized: false } : undefined,
  })
  t.after(() => pool.end())
  const client = await pool.connect()
  const userId = randomUUID()
  const workspaceId = randomUUID()
  const candidateId = randomUUID()
  try {
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO users (id, email, password_hash, full_name)
       VALUES ($1, $2, $3, $4)`,
      [userId, `${userId}@integration.invalid`, 'integration-test-hash', 'Integration Test User'],
    )
    await client.query('INSERT INTO workspaces (id, name) VALUES ($1, $2)', [workspaceId, 'Integration Test Workspace'])
    await client.query(
      `INSERT INTO workspace_memberships (workspace_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [workspaceId, userId],
    )
    await client.query(
      `INSERT INTO candidates
         (id, workspace_id, full_name, email, role_title, location, source, discovery_consent, discovery_eligible)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, true)`,
      [candidateId, workspaceId, 'Integration Candidate', `${candidateId}@integration.invalid`, 'Engineer', 'Remote', 'integration-test'],
    )
    await assert.rejects(
      client.query(
        `INSERT INTO candidates
           (id, workspace_id, full_name, email, role_title, location, source, discovery_consent, discovery_eligible)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, true)`,
        [randomUUID(), workspaceId, 'Duplicate Candidate', `${candidateId}@integration.invalid`, 'Engineer', 'Remote', 'integration-test'],
      ),
      /duplicate key/i,
    )
    await client.query('ROLLBACK')
  } finally {
    if (client._ending !== true) client.release()
  }
})

test('Supabase RLS verification remains blocked until Supabase Auth is mapped', { skip: true }, () => {
  assert.fail('The current Express session identity is not yet available as auth.uid()')
})
