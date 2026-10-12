-- Platform schema: single idempotent baseline for the whole app.
-- Always re-applied by scripts/migrate.mjs and runDatabaseMigrations.
-- Safe to re-run (IF NOT EXISTS / ON CONFLICT / ADD COLUMN IF NOT EXISTS).

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

-- Former 003: in-app workflows and inbox notifications
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  template_kind TEXT NOT NULL,
  created_by_email TEXT,
  trigger JSONB NOT NULL DEFAULT '{}'::jsonb,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  action JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflows_sheet_enabled
  ON workflows (sheet_id, enabled);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  sheet_id TEXT NOT NULL,
  row_id BIGINT,
  event_key TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_runs_event_key
  ON workflow_runs (workflow_id, event_key);

CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  workflow_id UUID,
  run_id UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_recipient
  ON user_notifications (recipient_email, read_at, created_at DESC);

-- Former 004: unified users directory
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  capability TEXT NOT NULL,
  PRIMARY KEY (role_id, capability)
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  display_name TEXT,
  password_hash TEXT NOT NULL DEFAULT '',
  password_salt TEXT NOT NULL DEFAULT '',
  reset_nonce TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_email_lower_chk CHECK (email = lower(email))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles (role_id);

INSERT INTO roles (id, label, description, sort_order) VALUES
  ('owner', 'Owner', 'Bootstrap owner with full control', 10),
  ('admin', 'Admin', 'Full workspace administration', 20),
  ('programs_team', 'Programs Team', 'Programs team workspace access', 30),
  ('coordinator', 'Coordinator', 'Form coordinator / sheet staff', 40),
  ('approver', 'Approver', 'Form approver', 50),
  ('contributor', 'Contributor', 'Public view contributor', 60),
  ('student', 'Student', 'Student portal', 70)
ON CONFLICT (id) DO NOTHING;

INSERT INTO role_permissions (role_id, capability) VALUES
  ('owner', 'admin.manage'),
  ('owner', 'admin.owner'),
  ('owner', 'forms.admin'),
  ('owner', 'forms.approver'),
  ('owner', 'contributor.edit'),
  ('owner', 'viewer'),
  ('admin', 'admin.manage'),
  ('admin', 'forms.admin'),
  ('admin', 'forms.approver'),
  ('admin', 'contributor.edit'),
  ('admin', 'viewer'),
  ('programs_team', 'admin.manage'),
  ('programs_team', 'forms.admin'),
  ('programs_team', 'forms.approver'),
  ('programs_team', 'contributor.edit'),
  ('programs_team', 'viewer'),
  ('coordinator', 'forms.coordinator'),
  ('coordinator', 'forms.approver'),
  ('coordinator', 'viewer'),
  ('approver', 'forms.approver'),
  ('approver', 'viewer'),
  ('contributor', 'contributor.edit'),
  ('student', 'forms.student'),
  ('student', 'viewer')
ON CONFLICT (role_id, capability) DO NOTHING;

INSERT INTO users (id, email, display_name, password_hash, password_salt, reset_nonce, is_active, created_at, updated_at)
SELECT
  CASE
    WHEN a.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN a.id::uuid
    ELSE gen_random_uuid()
  END,
  lower(a.username),
  a.display_name,
  COALESCE(a.password_hash, ''),
  COALESCE(a.password_salt, ''),
  a.reset_nonce,
  COALESCE(a.is_active, true),
  a.created_at,
  a.updated_at
FROM admin_users a
WHERE NOT EXISTS (
  SELECT 1 FROM users u WHERE u.email = lower(a.username)
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, a.role
FROM admin_users a
JOIN users u ON u.email = lower(a.username)
WHERE a.role IN ('admin', 'coordinator', 'programs_team')
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO users (email, password_hash, password_salt, reset_nonce, is_active, created_at, updated_at)
SELECT
  lower(s.email),
  s.password_hash,
  s.password_salt,
  s.reset_nonce,
  true,
  s.created_at,
  s.updated_at
FROM student_users s
WHERE NOT EXISTS (
  SELECT 1 FROM users u WHERE u.email = lower(s.email)
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, 'student'
FROM student_users s
JOIN users u ON u.email = lower(s.email)
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO users (email, password_hash, password_salt, reset_nonce, is_active, created_at, updated_at)
SELECT
  lower(c.email),
  c.password_hash,
  c.password_salt,
  c.reset_nonce,
  true,
  c.created_at,
  c.updated_at
FROM contributor_users c
WHERE NOT EXISTS (
  SELECT 1 FROM users u WHERE u.email = lower(c.email)
)
ON CONFLICT (email) DO NOTHING;

UPDATE users u
SET
  password_hash = c.password_hash,
  password_salt = c.password_salt,
  reset_nonce = COALESCE(replace(gen_random_uuid()::text, '-', ''), u.reset_nonce),
  updated_at = GREATEST(u.updated_at, c.updated_at)
FROM contributor_users c
WHERE u.email = lower(c.email)
  AND u.password_hash IS DISTINCT FROM c.password_hash
  AND c.password_hash <> ''
  AND NOT EXISTS (
    SELECT 1 FROM admin_users a WHERE lower(a.username) = u.email
  )
  AND c.updated_at > u.updated_at;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, 'contributor'
FROM contributor_users c
JOIN users u ON u.email = lower(c.email)
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO users (email, password_hash, password_salt, is_active, created_at, updated_at)
SELECT
  lower(f.email),
  f.password_hash,
  f.password_salt,
  true,
  f.created_at,
  f.updated_at
FROM form_approver_users f
WHERE NOT EXISTS (
  SELECT 1 FROM users u WHERE u.email = lower(f.email)
)
ON CONFLICT (email) DO NOTHING;

UPDATE users u
SET
  password_hash = f.password_hash,
  password_salt = f.password_salt,
  reset_nonce = COALESCE(replace(gen_random_uuid()::text, '-', ''), u.reset_nonce),
  updated_at = GREATEST(u.updated_at, f.updated_at)
FROM form_approver_users f
WHERE u.email = lower(f.email)
  AND u.password_hash IS DISTINCT FROM f.password_hash
  AND f.password_hash <> ''
  AND NOT EXISTS (
    SELECT 1 FROM admin_users a WHERE lower(a.username) = u.email
  )
  AND f.updated_at > u.updated_at;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, 'approver'
FROM form_approver_users f
JOIN users u ON u.email = lower(f.email)
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Former 006: app-wide runtime settings
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Former 007/008: imported Smartsheet sheets/reports for standalone mode
CREATE TABLE IF NOT EXISTS sheets (
  sheet_id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_row_count INTEGER NOT NULL DEFAULT 0,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rows (
  sheet_id BIGINT NOT NULL REFERENCES sheets(sheet_id) ON DELETE CASCADE,
  row_id BIGINT NOT NULL,
  row_number INTEGER,
  cells JSONB NOT NULL DEFAULT '[]'::jsonb,
  origin TEXT NOT NULL DEFAULT 'import',
  created_at TIMESTAMPTZ,
  modified_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sheet_id, row_id)
);

CREATE INDEX IF NOT EXISTS idx_rows_sheet ON rows (sheet_id);

CREATE TABLE IF NOT EXISTS reports (
  report_id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_rows (
  report_id BIGINT NOT NULL REFERENCES reports(report_id) ON DELETE CASCADE,
  row_id BIGINT NOT NULL,
  sheet_id BIGINT,
  cells JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, row_id)
);

CREATE INDEX IF NOT EXISTS idx_report_rows_report ON report_rows (report_id);

CREATE TABLE IF NOT EXISTS attachments (
  sheet_id BIGINT NOT NULL,
  attachment_id BIGINT NOT NULL,
  row_id BIGINT,
  name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  content BYTEA,
  url TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sheet_id, attachment_id)
);

CREATE INDEX IF NOT EXISTS idx_attachments_row ON attachments (sheet_id, row_id);

CREATE TABLE IF NOT EXISTS discussions (
  sheet_id BIGINT NOT NULL,
  discussion_id BIGINT NOT NULL,
  row_id BIGINT NOT NULL,
  title TEXT,
  comments JSONB NOT NULL DEFAULT '[]'::jsonb,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sheet_id, discussion_id)
);

CREATE INDEX IF NOT EXISTS idx_discussions_row ON discussions (sheet_id, row_id);

CREATE TABLE IF NOT EXISTS sheet_automations (
  sheet_id BIGINT NOT NULL,
  rule_id BIGINT NOT NULL,
  name TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sheet_id, rule_id)
);

CREATE INDEX IF NOT EXISTS idx_sheet_automations_sheet ON sheet_automations (sheet_id);

CREATE TABLE IF NOT EXISTS id_counters (
  kind TEXT PRIMARY KEY,
  next_id BIGINT NOT NULL
);

INSERT INTO id_counters (kind, next_id) VALUES ('sheet', -1), ('row', -1), ('attachment', -1), ('discussion', -1)
ON CONFLICT (kind) DO NOTHING;
