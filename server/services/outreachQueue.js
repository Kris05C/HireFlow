import { createHash, randomUUID } from 'node:crypto'

export async function claimQueuedRecipients(client, { workspaceId, campaignId, limit = 50 }) {
  const result = await client.query(
    `SELECT r.id, r.email, r.candidate_id
     FROM outreach_recipients r
     JOIN candidates c ON c.id = r.candidate_id AND c.workspace_id = r.workspace_id
     WHERE r.workspace_id = $1 AND r.campaign_id = $2 AND r.status = 'queued'
       AND c.discovery_eligible = true
       AND c.outreach_consent = true
       AND c.consent_recorded_at IS NOT NULL
       AND (c.retention_until IS NULL OR c.retention_until >= current_date)
       AND NOT EXISTS (
         SELECT 1 FROM outreach_unsubscribes u
         WHERE u.workspace_id = c.workspace_id AND lower(u.email) = lower(c.email)
       )
     ORDER BY r.created_at, r.id
     FOR UPDATE OF r, c SKIP LOCKED
     LIMIT $3`,
    [workspaceId, campaignId, limit],
  )
  const claimed = []
  for (const recipient of result.rows) {
    const unsubscribeToken = randomUUID().replaceAll('-', '')
    await client.query(
      `UPDATE outreach_recipients
       SET status = 'sending', unsubscribe_token_hash = $1, updated_at = now()
       WHERE id = $2 AND status = 'queued'`,
      [createHash('sha256').update(unsubscribeToken).digest('hex'), recipient.id],
    )
    claimed.push({ ...recipient, unsubscribeToken })
  }
  return claimed
}
