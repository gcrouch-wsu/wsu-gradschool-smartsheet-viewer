-- Programs Team role + pending contact-change (reroute) requests

ALTER TABLE IF EXISTS admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;

ALTER TABLE IF EXISTS admin_users
  ADD CONSTRAINT admin_users_role_check
  CHECK (role IN ('admin', 'coordinator', 'programs_team'));

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
