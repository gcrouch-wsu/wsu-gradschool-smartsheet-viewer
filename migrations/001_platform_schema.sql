-- Platform schema: Viewer config, contributors, admins, Forms, audit, PDF mapping.
-- Idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS) so existing deployments stay safe.
-- This file is the single source of truth for the platform schema (includes former 002–005).

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS config_sources (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS config_views (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS contributor_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contributor_users_email
  ON contributor_users(email);

ALTER TABLE contributor_users ADD COLUMN IF NOT EXISTS reset_nonce TEXT;

CREATE TABLE IF NOT EXISTS contributor_login_attempts (
  ip TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contributor_login_attempts_ip_at
  ON contributor_login_attempts(ip, attempted_at);

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Former 002: admin invite / password-reset support
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS reset_nonce TEXT;
-- Former 003: coordinator role (+ programs_team from 004)
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin';

ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE admin_users
  ADD CONSTRAINT admin_users_role_check
  CHECK (role IN ('admin', 'coordinator', 'programs_team'));

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  ip TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_ip_at
  ON admin_login_attempts(ip, attempted_at);

CREATE TABLE IF NOT EXISTS form_registry (
  id TEXT PRIMARY KEY DEFAULT 'registry',
  data JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS form_workflow_config (
  sheet_id TEXT PRIMARY KEY DEFAULT '',
  data JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS form_field_config (
  sheet_id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS form_conditional_rules (
  sheet_id TEXT PRIMARY KEY DEFAULT '',
  data JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS form_webhook_state (
  sheet_id TEXT PRIMARY KEY DEFAULT 'default',
  data JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS form_webhook_events (
  id BIGSERIAL PRIMARY KEY,
  sheet_id TEXT,
  event_type TEXT NOT NULL,
  object_id BIGINT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB
);

CREATE INDEX IF NOT EXISTS idx_form_webhook_events_sheet_at
  ON form_webhook_events(sheet_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS form_approver_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_approver_users_email
  ON form_approver_users(email);

-- Former 003: invite existing form approvers as coordinators (pending password setup).
INSERT INTO admin_users (
  id,
  username,
  display_name,
  password_hash,
  password_salt,
  created_at,
  updated_at,
  is_active,
  role
)
SELECT
  'coord-' || replace(lower(email), '@', '-at-'),
  lower(email),
  NULL,
  '',
  '',
  created_at,
  updated_at,
  true,
  'coordinator'
FROM form_approver_users
ON CONFLICT (username) DO NOTHING;

CREATE TABLE IF NOT EXISTS form_approver_login_attempts (
  ip TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_approver_login_attempts_ip_at
  ON form_approver_login_attempts(ip, attempted_at);

CREATE TABLE IF NOT EXISTS form_rate_limit_buckets (
  bucket_key TEXT NOT NULL,
  hit_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_rate_limit_buckets_key_at
  ON form_rate_limit_buckets(bucket_key, hit_at);

-- Former 004: pending contact-change (reroute) requests
CREATE TABLE IF NOT EXISTS form_contact_change_requests (
  id TEXT PRIMARY KEY,
  sheet_id TEXT NOT NULL,
  row_id BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_contact_change_requests_status
  ON form_contact_change_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_form_contact_change_requests_sheet_row
  ON form_contact_change_requests(sheet_id, row_id);

-- Former 005: per-sheet PDF mapping / generated submission PDF config
CREATE TABLE IF NOT EXISTS form_pdf_mapping (
  sheet_id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  template BYTEA,
  template_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGSERIAL PRIMARY KEY,
  actor_kind TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_label TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_created_at
  ON audit_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_resource
  ON audit_events(resource_type, resource_id);
