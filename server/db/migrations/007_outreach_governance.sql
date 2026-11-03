CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE outreach_recipients DROP CONSTRAINT outreach_recipients_status_check;
ALTER TABLE outreach_recipients
  ADD CONSTRAINT outreach_recipients_status_check
  CHECK (status IN ('queued', 'sending', 'sent', 'delivered', 'bounced', 'failed', 'unsubscribed'));

ALTER TABLE outreach_unsubscribes
  ALTER COLUMN candidate_id DROP NOT NULL,
  ADD COLUMN source text NOT NULL DEFAULT 'candidate-link',
  ADD COLUMN reason text;
ALTER TABLE outreach_unsubscribes
  DROP CONSTRAINT outreach_unsubscribes_candidate_id_fkey,
  ADD CONSTRAINT outreach_unsubscribes_candidate_id_fkey
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL;

CREATE TABLE outreach_unsubscribe_events (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  candidate_id uuid REFERENCES candidates(id) ON DELETE SET NULL,
  recipient_id uuid REFERENCES outreach_recipients(id) ON DELETE SET NULL,
  email text NOT NULL,
  source text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outreach_unsubscribe_events_candidate_idx
  ON outreach_unsubscribe_events (workspace_id, candidate_id, occurred_at DESC);

CREATE TABLE candidate_consent_events (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  candidate_id uuid REFERENCES candidates(id) ON DELETE SET NULL,
  consent_type text NOT NULL CHECK (consent_type IN ('outreach')),
  granted boolean NOT NULL,
  source text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX candidate_consent_events_candidate_idx
  ON candidate_consent_events (workspace_id, candidate_id, recorded_at DESC);

CREATE OR REPLACE FUNCTION prevent_outreach_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Outreach governance history is append-only';
END;
$$;

CREATE TRIGGER outreach_unsubscribe_events_immutable
BEFORE UPDATE OR DELETE ON outreach_unsubscribe_events
FOR EACH ROW EXECUTE FUNCTION prevent_outreach_history_mutation();

CREATE TRIGGER candidate_consent_events_immutable
BEFORE UPDATE OR DELETE ON candidate_consent_events
FOR EACH ROW EXECUTE FUNCTION prevent_outreach_history_mutation();

CREATE OR REPLACE FUNCTION record_candidate_outreach_consent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO candidate_consent_events
      (id, workspace_id, candidate_id, consent_type, granted, source)
    VALUES
      (gen_random_uuid(), NEW.workspace_id, NEW.id, 'outreach', NEW.outreach_consent, 'candidate-record');
  ELSIF NEW.outreach_consent IS DISTINCT FROM OLD.outreach_consent THEN
    INSERT INTO candidate_consent_events
      (id, workspace_id, candidate_id, consent_type, granted, source)
    VALUES
      (gen_random_uuid(), NEW.workspace_id, NEW.id, 'outreach', NEW.outreach_consent, 'candidate-record');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER candidates_outreach_consent_history
AFTER INSERT OR UPDATE OF outreach_consent ON candidates
FOR EACH ROW EXECUTE FUNCTION record_candidate_outreach_consent();
