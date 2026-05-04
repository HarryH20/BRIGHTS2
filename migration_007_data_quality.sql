-- Migration 007: Data quality flags infrastructure

-- Create data_quality_flags table (base table, if not already created)
CREATE TABLE IF NOT EXISTS data_quality_flags (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    round_id        INTEGER REFERENCES study_rounds(id) ON DELETE SET NULL,
    submission_id   INTEGER REFERENCES survey_submissions(id) ON DELETE SET NULL,
    flag_type       TEXT NOT NULL,
    severity        TEXT NOT NULL,
    detail          JSONB,
    auto_generated  BOOLEAN NOT NULL DEFAULT TRUE,
    is_resolved     BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at     TIMESTAMPTZ,
    justification   TEXT NOT NULL DEFAULT '',
    resolved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dqf_user
  ON data_quality_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_dqf_round
  ON data_quality_flags(round_id);
CREATE INDEX IF NOT EXISTS idx_dqf_submission
  ON data_quality_flags(submission_id);
CREATE INDEX IF NOT EXISTS idx_dqf_unresolved
  ON data_quality_flags(round_id, is_resolved, severity);

CREATE TABLE IF NOT EXISTS quality_check_runs (
    id              SERIAL PRIMARY KEY,
    submission_id   INTEGER REFERENCES survey_submissions(id)
                      ON DELETE SET NULL,
    round_id        INTEGER REFERENCES study_rounds(id)
                      ON DELETE SET NULL,
    triggered_by    TEXT NOT NULL
                      CHECK (triggered_by IN (
                        'auto_post_submit',
                        'manual_admin',
                        'nightly_batch'
                      )),
    triggered_by_user_id INTEGER
                      REFERENCES users(id) ON DELETE SET NULL,
    config_snapshot JSONB NOT NULL,
    code_version    TEXT NOT NULL DEFAULT 'unknown',
    flags_created   INTEGER NOT NULL DEFAULT 0,
    duration_ms     INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_qc_runs_submission
  ON quality_check_runs(submission_id);
CREATE INDEX IF NOT EXISTS idx_qc_runs_round
  ON quality_check_runs(round_id);

CREATE TABLE IF NOT EXISTS flag_threshold_configs (
    id              SERIAL PRIMARY KEY,
    round_id        INTEGER NOT NULL
                      REFERENCES study_rounds(id)
                      ON DELETE CASCADE,
    flag_type       TEXT NOT NULL,
    thresholds      JSONB NOT NULL,
    preregistered   BOOLEAN NOT NULL DEFAULT FALSE,
    prereg_url      TEXT,
    effective_from  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      INTEGER REFERENCES users(id)
                      ON DELETE SET NULL,
    UNIQUE (round_id, flag_type, effective_from)
);
CREATE INDEX IF NOT EXISTS idx_flag_thresholds_round
  ON flag_threshold_configs(round_id, flag_type);

-- Add justification to data_quality_flags (for existing deployments that already have the table)
ALTER TABLE data_quality_flags
  ADD COLUMN IF NOT EXISTS justification TEXT
    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS resolved_by_user_id INTEGER
    REFERENCES users(id) ON DELETE SET NULL;
