-- Separate student portal accounts from contributor_users.
-- Idempotent for re-runs; data migration of existing rows is handled in app code.

CREATE TABLE IF NOT EXISTS student_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reset_nonce TEXT
);

CREATE INDEX IF NOT EXISTS idx_student_users_email
  ON student_users(email);

ALTER TABLE student_users ADD COLUMN IF NOT EXISTS reset_nonce TEXT;
