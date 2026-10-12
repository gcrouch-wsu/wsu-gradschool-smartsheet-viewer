/**
 * Versioned SQL migrations. Applied on first DB access when DATABASE_URL is set.
 * File-store mode (no DATABASE_URL) skips migrations entirely.
 *
 * Only `001_platform_schema.sql` exists; it is always re-applied (idempotent).
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isDatabaseConfigEnabled, queryConfigDb } from "@/lib/config/config-db";
import { ensureCurrentAppRoleRls } from "@/lib/db-rls";

const BASELINE = "001_platform_schema.sql";

/** Former incremental migration ids — recorded so history stays consistent. */
const SUPERSEDED = [
  "002_admin_reset_nonce.sql",
  "002_student_users.sql",
  "003_admin_coordinator_role.sql",
  "003_workflows.sql",
  "004_programs_team_contact_changes.sql",
  "004_unified_users.sql",
  "005_form_pdf_mapping.sql",
  "005_deprecate_legacy_accounts.sql",
  "005_retire_legacy_accounts_deferred.sql",
  "006_app_settings.sql",
  "007_local_sheets.sql",
  "008_rename_local_sheets_to_sheets.sql",
] as const;

const RLS_TABLES = [
  "config_sources",
  "config_views",
  "contributor_users",
  "student_users",
  "contributor_login_attempts",
  "admin_users",
  "admin_login_attempts",
  "form_registry",
  "form_workflow_config",
  "form_field_config",
  "form_conditional_rules",
  "form_webhook_state",
  "form_webhook_events",
  "form_approver_users",
  "form_approver_login_attempts",
  "form_rate_limit_buckets",
  "form_contact_change_requests",
  "form_pdf_mapping",
  "audit_events",
  "workflows",
  "workflow_runs",
  "user_notifications",
  "users",
  "roles",
  "role_permissions",
  "user_roles",
  "app_settings",
  "sheets",
  "rows",
  "reports",
  "report_rows",
  "attachments",
  "discussions",
  "sheet_automations",
  "id_counters",
] as const;

let migratePromise: Promise<void> | null = null;

function migrationsDir() {
  return join(process.cwd(), "migrations");
}

async function ensureMigrationsTable() {
  await queryConfigDb(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

/**
 * Apply the baseline schema then ensure RLS on known tables.
 * Safe to call repeatedly; no-op without DATABASE_URL.
 */
export async function runDatabaseMigrations(): Promise<void> {
  if (!isDatabaseConfigEnabled()) {
    return;
  }

  if (!migratePromise) {
    migratePromise = (async () => {
      await ensureMigrationsTable();
      const sql = await readFile(join(migrationsDir(), BASELINE), "utf8");
      await queryConfigDb(sql);
      await queryConfigDb("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING", [
        BASELINE,
      ]);
      for (const file of SUPERSEDED) {
        await queryConfigDb("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING", [
          file,
        ]);
      }
      for (const table of RLS_TABLES) {
        await ensureCurrentAppRoleRls(queryConfigDb, table);
      }
    })().catch((err) => {
      migratePromise = null;
      throw err;
    });
  }

  await migratePromise;
}
