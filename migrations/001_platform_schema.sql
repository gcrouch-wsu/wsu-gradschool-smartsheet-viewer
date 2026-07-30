-- Platform schema: Viewer config, contributors, admins, Forms, audit.
-- Idempotent (IF NOT EXISTS) so existing deployments stay safe.

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

ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS reset_nonce TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin';

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
