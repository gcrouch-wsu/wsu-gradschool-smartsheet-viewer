import { isDatabaseConfigEnabled, queryConfigDb } from "@/lib/config/config-db";
import { ensureCurrentAppRoleRls } from "@/lib/db-rls";

export { queryConfigDb as queryFormsDb };

const FORMS_TABLES = [
  "form_registry",
  "form_workflow_config",
  "form_field_config",
  "form_conditional_rules",
  "form_webhook_state",
  "form_webhook_events",
  "form_approver_users",
  "form_approver_login_attempts",
  "form_rate_limit_buckets",
] as const;

let ensureTablesPromise: Promise<void> | null = null;

export async function ensureFormsTables() {
  if (!isFormsDatabaseEnabled()) {
    return;
  }

  if (!ensureTablesPromise) {
    ensureTablesPromise = (async () => {
      await queryConfigDb(`
        CREATE TABLE IF NOT EXISTS form_registry (
          id TEXT PRIMARY KEY DEFAULT 'registry',
          data JSONB NOT NULL
        )
      `);
      await queryConfigDb(`
        CREATE TABLE IF NOT EXISTS form_workflow_config (
          sheet_id TEXT PRIMARY KEY DEFAULT '',
          data JSONB NOT NULL
        )
      `);
      await queryConfigDb(`
        CREATE TABLE IF NOT EXISTS form_field_config (
          sheet_id TEXT PRIMARY KEY,
          data JSONB NOT NULL
        )
      `);
      await queryConfigDb(`
        CREATE TABLE IF NOT EXISTS form_conditional_rules (
          sheet_id TEXT PRIMARY KEY DEFAULT '',
          data JSONB NOT NULL
        )
      `);
      await queryConfigDb(`
        CREATE TABLE IF NOT EXISTS form_webhook_state (
          sheet_id TEXT PRIMARY KEY DEFAULT 'default',
          data JSONB NOT NULL
        )
      `);
      await queryConfigDb(`
        CREATE TABLE IF NOT EXISTS form_webhook_events (
          id BIGSERIAL PRIMARY KEY,
          sheet_id TEXT,
          event_type TEXT NOT NULL,
          object_id BIGINT,
          occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          payload JSONB
        )
      `);
      await queryConfigDb(`
        CREATE INDEX IF NOT EXISTS idx_form_webhook_events_sheet_at
        ON form_webhook_events(sheet_id, occurred_at DESC)
      `);
      await queryConfigDb(`
        CREATE TABLE IF NOT EXISTS form_approver_users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          password_salt TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await queryConfigDb(`
        CREATE INDEX IF NOT EXISTS idx_form_approver_users_email
        ON form_approver_users(email)
      `);
      await queryConfigDb(`
        CREATE TABLE IF NOT EXISTS form_approver_login_attempts (
          ip TEXT NOT NULL,
          attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await queryConfigDb(`
        CREATE INDEX IF NOT EXISTS idx_form_approver_login_attempts_ip_at
        ON form_approver_login_attempts(ip, attempted_at)
      `);
      await queryConfigDb(`
        CREATE TABLE IF NOT EXISTS form_rate_limit_buckets (
          bucket_key TEXT NOT NULL,
          hit_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await queryConfigDb(`
        CREATE INDEX IF NOT EXISTS idx_form_rate_limit_buckets_key_at
        ON form_rate_limit_buckets(bucket_key, hit_at)
      `);

      for (const tableName of FORMS_TABLES) {
        await ensureCurrentAppRoleRls(queryConfigDb, tableName);
      }
    })().catch((err) => {
      ensureTablesPromise = null;
      throw err;
    });
  }

  await ensureTablesPromise;
}

/** True when `DATABASE_URL` is set (Postgres-backed forms storage). */
export function isFormsDatabaseEnabled(): boolean {
  return isDatabaseConfigEnabled();
}
