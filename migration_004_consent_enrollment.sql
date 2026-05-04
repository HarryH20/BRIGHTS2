-- Migration 004: Consent + enrollment metadata
-- Run in Supabase SQL Editor. Safe to run multiple times (IF NOT EXISTS / IF NOT EXISTS guards).

-- ── study_rounds: join_code column ────────────────────────────────────────────
ALTER TABLE study_rounds
  ADD COLUMN IF NOT EXISTS join_code TEXT;

-- Generate join codes for any existing rounds that don't have one
UPDATE study_rounds
  SET join_code = UPPER(SUBSTRING(MD5(id::text || random()::text), 1, 8))
  WHERE join_code IS NULL;

-- ── consent_forms ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consent_forms (
    id         SERIAL PRIMARY KEY,
    study_id   INTEGER NOT NULL REFERENCES studies(id) ON DELETE RESTRICT,
    title      TEXT NOT NULL,
    is_active  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_consent_forms_study
  ON consent_forms(study_id);

-- ── participant_consents ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS participant_consents (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    consent_form_id INTEGER REFERENCES consent_forms(id) ON DELETE SET NULL,
    round_id        INTEGER REFERENCES study_rounds(id) ON DELETE SET NULL,
    consented_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address      TEXT,
    user_agent      TEXT
);
CREATE INDEX IF NOT EXISTS idx_participant_consents_user
  ON participant_consents(user_id);

-- ── pending_enrollments ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pending_enrollments (
    token           TEXT PRIMARY KEY,
    round_id        INTEGER NOT NULL REFERENCES study_rounds(id),
    join_code       TEXT NOT NULL,
    issued_ip_hash  TEXT,
    issued_ua       TEXT,
    utm_source      TEXT,
    utm_medium      TEXT,
    utm_campaign    TEXT,
    referrer        TEXT,
    expires_at      TIMESTAMPTZ NOT NULL,
    consumed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pending_enroll_round
  ON pending_enrollments(round_id);
CREATE INDEX IF NOT EXISTS idx_pending_enroll_expires
  ON pending_enrollments(expires_at)
  WHERE consumed_at IS NULL;

-- ── consent_form_revisions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consent_form_revisions (
    id                    SERIAL PRIMARY KEY,
    consent_form_id       INTEGER NOT NULL
      REFERENCES consent_forms(id) ON DELETE RESTRICT,
    version               TEXT NOT NULL,
    body_markdown         TEXT NOT NULL,
    body_hash             TEXT NOT NULL,
    prev_revision_hash    TEXT,
    irb_approval_number   TEXT,
    irb_approval_date     DATE,
    created_by            INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    change_summary        TEXT,
    is_material_change    BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (consent_form_id, version)
);

-- ── consent_acknowledgments ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consent_acknowledgments (
    id                       SERIAL PRIMARY KEY,
    participant_consent_id   INTEGER NOT NULL
      REFERENCES participant_consents(id) ON DELETE RESTRICT,
    section_key              TEXT NOT NULL,
    scrolled_to_end_at       TIMESTAMPTZ,
    dwell_seconds            INTEGER,
    comprehension_quiz       JSONB,
    acknowledged_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_consent_ack_consent
  ON consent_acknowledgments(participant_consent_id);

-- ── withdrawal_requests ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id                       SERIAL PRIMARY KEY,
    user_id                  INTEGER NOT NULL
      REFERENCES users(id) ON DELETE RESTRICT,
    study_id                 INTEGER REFERENCES studies(id) ON DELETE SET NULL,
    round_id                 INTEGER REFERENCES study_rounds(id) ON DELETE SET NULL,
    scope                    TEXT NOT NULL DEFAULT 'full'
      CHECK (scope IN ('full','data_only','future_only')),
    reason_optional          TEXT,
    requested_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data_deletion_requested  BOOLEAN NOT NULL DEFAULT FALSE,
    data_deletion_resolution TEXT,
    processed_by             INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ip_address               TEXT,
    user_agent               TEXT
);
CREATE INDEX IF NOT EXISTS idx_withdrawal_user
  ON withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_study
  ON withdrawal_requests(study_id);

-- ── Add new columns to participant_consents ───────────────────────────────────
ALTER TABLE participant_consents
  ADD COLUMN IF NOT EXISTS consent_form_revision_id INTEGER
    REFERENCES consent_form_revisions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signature_method TEXT,
  ADD COLUMN IF NOT EXISTS signature_payload JSONB,
  ADD COLUMN IF NOT EXISTS signature_meaning TEXT
    DEFAULT 'I consent to participate',
  ADD COLUMN IF NOT EXISTS pdf_storage_url TEXT,
  ADD COLUMN IF NOT EXISTS pdf_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS record_hash TEXT;

-- ── Add new columns to enrollments ───────────────────────────────────────────
ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS device_type TEXT,
  ADD COLUMN IF NOT EXISTS user_agent_hash TEXT,
  ADD COLUMN IF NOT EXISTS enrolled_ip_hash TEXT,
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS referrer TEXT,
  ADD COLUMN IF NOT EXISTS join_method TEXT,
  ADD COLUMN IF NOT EXISTS consent_version TEXT;

-- ── Immutability enforcement ──────────────────────────────────────────────────
-- Revoke UPDATE/DELETE on audit-sensitive tables to prevent tampering.
-- NOTE: Replace 'postgres' with your actual application DB role if different.
REVOKE UPDATE, DELETE ON consent_form_revisions,
  consent_acknowledgments, withdrawal_requests
  FROM postgres;
