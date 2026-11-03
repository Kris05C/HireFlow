ALTER TABLE candidates
  ADD COLUMN pipeline_status text NOT NULL DEFAULT 'New'
  CHECK (pipeline_status IN ('New', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'));

CREATE TABLE candidate_folders (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);
CREATE INDEX candidate_folders_workspace_idx ON candidate_folders (workspace_id, created_at DESC);

CREATE TABLE candidate_folder_memberships (
  folder_id uuid NOT NULL REFERENCES candidate_folders(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  added_by uuid NOT NULL REFERENCES users(id),
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (folder_id, candidate_id)
);
CREATE INDEX candidate_folder_memberships_candidate_idx ON candidate_folder_memberships (candidate_id);

CREATE TABLE candidate_notes (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX candidate_notes_workspace_candidate_idx ON candidate_notes (workspace_id, candidate_id, created_at DESC);
