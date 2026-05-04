-- Migration 006: Conditions, allocation, notifications

-- Condition definitions per round
CREATE TABLE IF NOT EXISTS study_conditions (
    id              SERIAL PRIMARY KEY,
    round_id        INTEGER NOT NULL
                      REFERENCES study_rounds(id) ON DELETE CASCADE,
    label           TEXT NOT NULL,
    group_name      TEXT,
    description     TEXT,
    color           VARCHAR(20),
    max_capacity    INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (round_id, label)
);

-- Add condition tracking to enrollments (existing table)
ALTER TABLE enrollments
    ADD COLUMN IF NOT EXISTS condition_label TEXT,
    ADD COLUMN IF NOT EXISTS condition_group  TEXT;

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL
                      REFERENCES users(id) ON DELETE CASCADE,
    round_id        INTEGER REFERENCES study_rounds(id) ON DELETE SET NULL,
    type            TEXT NOT NULL,
    title           TEXT NOT NULL,
    body            TEXT,
    action_url      TEXT,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Condition assignment strategies per round
CREATE TABLE IF NOT EXISTS condition_assignment_strategies (
    id              SERIAL PRIMARY KEY,
    round_id        INTEGER NOT NULL UNIQUE
                      REFERENCES study_rounds(id) ON DELETE CASCADE,
    algorithm       TEXT NOT NULL DEFAULT 'permuted_block'
                      CHECK (algorithm IN (
                        'simple_random',
                        'permuted_block',
                        'stratified_block',
                        'manual'
                      )),
    block_sizes     INTEGER[] NOT NULL DEFAULT '{4,6,8}',
    stratify_by     TEXT[],
    rng_seed        TEXT,
    is_locked       BOOLEAN NOT NULL DEFAULT FALSE,
    locked_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pre-generated allocation sequence
CREATE TABLE IF NOT EXISTS allocation_sequence (
    id                    SERIAL PRIMARY KEY,
    round_id              INTEGER NOT NULL
                            REFERENCES study_rounds(id) ON DELETE CASCADE,
    sequence_index        INTEGER NOT NULL,
    condition_label       TEXT NOT NULL,
    strata_key            TEXT,
    consumed_by_enrollment_id INTEGER UNIQUE
                            REFERENCES enrollments(id) ON DELETE SET NULL,
    consumed_at           TIMESTAMPTZ,
    UNIQUE (round_id, sequence_index)
);
CREATE INDEX IF NOT EXISTS idx_alloc_seq_round_unconsumed
  ON allocation_sequence(round_id, sequence_index)
  WHERE consumed_by_enrollment_id IS NULL;

-- Immutable allocation log
CREATE TABLE IF NOT EXISTS allocation_log (
    id                    SERIAL PRIMARY KEY,
    enrollment_id         INTEGER NOT NULL
                            REFERENCES enrollments(id) ON DELETE RESTRICT,
    round_id              INTEGER NOT NULL
                            REFERENCES study_rounds(id),
    user_id               INTEGER NOT NULL
                            REFERENCES users(id),
    condition_label       TEXT NOT NULL,
    condition_group       TEXT,
    prior_condition_label TEXT,
    strategy              TEXT NOT NULL,
    strata_key            TEXT,
    sequence_index        INTEGER,
    assigned_by           INTEGER REFERENCES users(id),
    reason                TEXT,
    assigned_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
REVOKE UPDATE, DELETE ON allocation_log FROM postgres;
CREATE INDEX IF NOT EXISTS idx_alloc_log_round
  ON allocation_log(round_id);
CREATE INDEX IF NOT EXISTS idx_alloc_log_enrollment
  ON allocation_log(enrollment_id);

-- Notification preferences per user
CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id               INTEGER PRIMARY KEY
                            REFERENCES users(id) ON DELETE CASCADE,
    reminders_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    quiet_hours_start     INTEGER DEFAULT 9,
    quiet_hours_end       INTEGER DEFAULT 21,
    timezone              TEXT DEFAULT 'America/Chicago',
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notification delivery log for analysis
CREATE TABLE IF NOT EXISTS notification_delivery_log (
    id                    SERIAL PRIMARY KEY,
    notification_id       INTEGER NOT NULL
                            REFERENCES notifications(id) ON DELETE CASCADE,
    user_id               INTEGER NOT NULL
                            REFERENCES users(id),
    round_id              INTEGER REFERENCES study_rounds(id),
    condition_label       TEXT,
    notification_type     TEXT NOT NULL,
    delivered_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    opened_at             TIMESTAMPTZ,
    action_taken_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_notif_delivery_user
  ON notification_delivery_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_delivery_round
  ON notification_delivery_log(round_id);

-- Indexes on notifications table
CREATE INDEX IF NOT EXISTS idx_notif_user_unread
  ON notifications(user_id)
  WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notif_expires
  ON notifications(expires_at)
  WHERE expires_at IS NOT NULL;
