CREATE TABLE outreach_templates (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);
CREATE INDEX outreach_templates_workspace_idx ON outreach_templates (workspace_id, updated_at DESC);

ALTER TABLE campaigns
  ADD COLUMN template_id uuid REFERENCES outreach_templates(id) ON DELETE SET NULL,
  ADD COLUMN scheduled_at timestamptz,
  ADD COLUMN unsubscribe_required boolean NOT NULL DEFAULT true;

CREATE TABLE outreach_recipients (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  email text NOT NULL,
  consent_snapshot boolean NOT NULL,
  consent_recorded_at timestamptz,
  unsubscribe_token_hash char(64) NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'bounced', 'failed', 'unsubscribed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, candidate_id)
);
CREATE INDEX outreach_recipients_campaign_idx ON outreach_recipients (campaign_id, status);

CREATE TABLE outreach_events (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES outreach_recipients(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('queued', 'sent', 'delivered', 'bounced', 'failed', 'unsubscribed')),
  provider_event_id text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_event_id)
);
CREATE INDEX outreach_events_recipient_idx ON outreach_events (recipient_id, occurred_at DESC);

CREATE TABLE outreach_unsubscribes (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX outreach_unsubscribes_workspace_email_idx ON outreach_unsubscribes (workspace_id, lower(email));
