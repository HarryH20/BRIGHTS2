-- Migration 005: Researcher roles and invitations

CREATE TABLE IF NOT EXISTS researcher_invitations (
    id          SERIAL PRIMARY KEY,
    study_id    INTEGER NOT NULL REFERENCES studies(id)
                  ON DELETE CASCADE,
    role        TEXT NOT NULL
                  CHECK (role IN ('pi','research_assistant',
                    'data_manager','observer')),
    token_hash  TEXT NOT NULL UNIQUE,
    created_by  INTEGER REFERENCES users(id)
                  ON DELETE SET NULL,
    redeemed_by INTEGER REFERENCES users(id)
                  ON DELETE SET NULL,
    redeemed_at TIMESTAMPTZ,
    expires_at  TIMESTAMPTZ NOT NULL,
    max_uses    INTEGER NOT NULL DEFAULT 1,
    uses        INTEGER NOT NULL DEFAULT 0,
    revoked_at  TIMESTAMPTZ,
    revoked_by  INTEGER REFERENCES users(id)
                  ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_researcher_inv_study
  ON researcher_invitations(study_id);
CREATE INDEX IF NOT EXISTS idx_researcher_inv_token
  ON researcher_invitations(token_hash);

-- Add columns to researcher_roles
ALTER TABLE researcher_roles
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_by INTEGER
    REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_access_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS citi_completion_date DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Immutable audit
REVOKE UPDATE, DELETE ON researcher_invitations
  FROM postgres;
