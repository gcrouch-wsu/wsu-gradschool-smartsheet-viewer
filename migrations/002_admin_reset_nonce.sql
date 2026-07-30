-- Admin invite / password-reset support
ALTER TABLE IF EXISTS admin_users ADD COLUMN IF NOT EXISTS reset_nonce TEXT;
