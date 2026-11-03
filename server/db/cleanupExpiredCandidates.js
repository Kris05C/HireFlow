import { randomUUID } from 'node:crypto'
import { assertServerConfig } from '../config.js'
import { pool } from './pool.js'
import { logger } from '../observability.js'

const apply = process.argv.includes('--apply')

assertServerConfig()

const client = await pool.connect()

try {
  const expired = await client.query(
    `SELECT id, workspace_id
     FROM candidates
     WHERE retention_until IS NOT NULL AND retention_until < current_date
     ORDER BY retention_until ASC`,
  )

  if (!apply) {
    logger.info('Retention cleanup dry run', { candidateCount: expired.rowCount })
  } else if (process.env.ALLOW_DESTRUCTIVE_RETENTION_CLEANUP !== 'true') {
    throw new Error('Refusing destructive cleanup. Set ALLOW_DESTRUCTIVE_RETENTION_CLEANUP=true and pass --apply.')
  } else {
    await client.query('BEGIN')
    for (const candidate of expired.rows) {
      await client.query(
        `INSERT INTO activity_events (id, workspace_id, actor_id, event_type, entity_type, entity_id, summary)
         VALUES ($1, $2, NULL, 'candidate.retention_deleted', 'candidate', $3, 'Deleted candidate profile after retention period expired')`,
        [randomUUID(), candidate.workspace_id, candidate.id],
      )
    }
    await client.query(
      'DELETE FROM candidates WHERE retention_until IS NOT NULL AND retention_until < current_date',
    )
    await client.query('COMMIT')
    logger.info('Retention cleanup applied', { candidateCount: expired.rowCount })
  }
} catch (error) {
  await client.query('ROLLBACK').catch(() => {})
  logger.error('Retention cleanup failed', { errorName: error.name, errorCode: error.code })
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
