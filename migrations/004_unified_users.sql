-- Unified users directory: one account, many roles, editable permission matrix.
-- Migrates admin_users, student_users, contributor_users, form_approver_users.
-- Old tables remain; app reads from users after this migration. Idempotent.

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

-- Seed platform roles
INSERT INTO roles (id, label, description, sort_order) VALUES
  ('owner', 'Owner', 'Bootstrap owner with full control', 10),
  ('admin', 'Admin', 'Full workspace administration', 20),
  ('programs_team', 'Programs Team', 'Programs team workspace access', 30),
  ('coordinator', 'Coordinator', 'Form coordinator / sheet staff', 40),
  ('approver', 'Approver', 'Form approver', 50),
  ('contributor', 'Contributor', 'Public view contributor', 60),
  ('student', 'Student', 'Student portal', 70)
ON CONFLICT (id) DO NOTHING;

-- Seed capabilities matching src/lib/identity/roles.ts ROLE_CAPABILITIES
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

-- Migrate admin_users (prefer admin password when email collides)
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

-- Migrate student_users
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

-- Migrate contributor_users (skip if admin already owns the email)
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

-- Password collision: if user already existed from student (not admin), keep newer hash
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

-- Migrate form_approver_users
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
