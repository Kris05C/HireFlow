import { createHash } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { recordActivity } from '../services/activity.js'

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{32,200}$/)

export function createOutreachRouter(databasePool) {
  const router = Router()

  router.get('/unsubscribe/:token', async (req, res, next) => {
    const parsed = tokenSchema.safeParse(req.params.token)
    if (!parsed.success) return res.status(400).json({ error: 'The unsubscribe link is invalid.', code: 'INVALID_UNSUBSCRIBE_TOKEN' })
    const tokenHash = createHash('sha256').update(parsed.data).digest('hex')
    let client
    try {
      client = await databasePool.connect()
      await client.query('BEGIN')
      const recipient = await client.query(
        `SELECT r.id, r.workspace_id, r.candidate_id, r.email, c.full_name
         FROM outreach_recipients r
         JOIN candidates c ON c.id = r.candidate_id AND c.workspace_id = r.workspace_id
         WHERE r.unsubscribe_token_hash = $1
         FOR UPDATE OF r, c`,
        [tokenHash],
      )
      if (!recipient.rowCount) {
        await client.query('ROLLBACK')
        return res.status(404).json({ error: 'This unsubscribe link is invalid or has expired.', code: 'UNSUBSCRIBE_NOT_FOUND' })
      }
      const row = recipient.rows[0]
      await client.query(
        `INSERT INTO outreach_unsubscribes (id, workspace_id, candidate_id, email, source)
         VALUES (gen_random_uuid(), $1, $2, $3, 'candidate-link')
         ON CONFLICT (workspace_id, lower(email)) DO NOTHING`,
        [row.workspace_id, row.candidate_id, row.email],
      )
      await client.query(
        `INSERT INTO outreach_unsubscribe_events
           (id, workspace_id, candidate_id, recipient_id, email, source)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'candidate-link')`,
        [row.workspace_id, row.candidate_id, row.id, row.email],
      )
      await client.query(
        `UPDATE candidates
         SET outreach_consent = false, consent_recorded_at = now(), updated_at = now()
         WHERE id = $1 AND workspace_id = $2`,
        [row.candidate_id, row.workspace_id],
      )
      await client.query(
        `UPDATE outreach_recipients
         SET status = 'unsubscribed', updated_at = now()
         WHERE candidate_id = $1 AND workspace_id = $2
           AND status IN ('queued', 'sending')`,
        [row.candidate_id, row.workspace_id],
      )
      await recordActivity(client, {
        workspaceId: row.workspace_id,
        actorId: null,
        eventType: 'candidate.outreach_unsubscribed',
        entityType: 'candidate',
        entityId: row.candidate_id,
        summary: 'Candidate unsubscribed from outreach',
      })
      await client.query('COMMIT')
      return res.json({ unsubscribed: true, message: 'You have been unsubscribed from future outreach.' })
    } catch (error) {
      await client?.query('ROLLBACK').catch(() => {})
      return next(error)
    } finally {
      client?.release()
    }
  })

  return router
}
