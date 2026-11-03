ALTER TABLE campaigns DROP CONSTRAINT campaigns_status_check;
ALTER TABLE campaigns
  ADD CONSTRAINT campaigns_status_check
  CHECK (status IN ('Draft', 'Queued', 'Scheduled', 'Sending', 'Sent', 'Failed', 'Cancelled'));

ALTER TABLE campaigns
  ADD COLUMN queued_at timestamptz,
  ADD COLUMN queued_by uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE campaign_queue_requests (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, campaign_id, idempotency_key)
);
CREATE INDEX campaign_queue_requests_workspace_idx ON campaign_queue_requests (workspace_id, created_at DESC);
