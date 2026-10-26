import { randomUUID } from 'node:crypto'

export async function recordActivity(client, { workspaceId, actorId, eventType, entityType, entityId, summary }) {
  await client.query(
    `INSERT INTO activity_events (id, workspace_id, actor_id, event_type, entity_type, entity_id, summary)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [randomUUID(), workspaceId, actorId, eventType, entityType, entityId, summary],
  )
}