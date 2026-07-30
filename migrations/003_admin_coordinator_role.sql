-- Coordinator role on managed admin users + fold form approvers

ALTER TABLE IF EXISTS admin_users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_users_role_check'
  ) THEN
    ALTER TABLE admin_users
      ADD CONSTRAINT admin_users_role_check
      CHECK (role IN ('admin', 'coordinator'));
  END IF;
END $$;

-- Invite existing form approvers as coordinators (pending password setup if email not already an admin).
DO $$
BEGIN
  IF to_regclass('public.form_approver_users') IS NOT NULL THEN
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
  END IF;
END $$;
