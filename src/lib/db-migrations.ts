/**
 * Versioned SQL migrations. Applied on first DB access when DATABASE_URL is set.
 * File-store mode (no DATABASE_URL) skips migrations entirely.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { isDatabaseConfigEnabled, queryConfigDb } from "@/lib/config/config-db";
import { ensureCurrentAppRoleRls } from "@/lib/db-rls";

const RLS_TABLES = [
  "config_sources",
  "config_views",
  "contributor_users",
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
  "audit_events",
] as const;

let migratePromise: Promise<void> | null = null;

function migrationsDir() {
  return join(process.cwd(), "migrations");
}

async function listMigrationFiles(): Promise<string[]> {
  try {
    const entries = await readdir(migrationsDir());
    return entries.filter((f) => f.endsWith(".sql")).sort();
  } catch {
    return [];
  }
}

async function ensureMigrationsTable() {
  await queryConfigDb(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function appliedMigrationIds(): Promise<Set<string>> {
  const { rows } = await queryConfigDb<{ id: string }>("SELECT id FROM schema_migrations");
  return new Set(rows.map((r) => r.id));
}

async function applyMigrationFile(filename: string) {
  const sql = await readFile(join(migrationsDir(), filename), "utf8");
  // Run as a single script; statements are idempotent.
  await queryConfigDb(sql);
  await queryConfigDb("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING", [
    filename,
  ]);
}

/**
 * Apply pending migrations then ensure RLS on known tables.
 * Safe to call repeatedly; no-op without DATABASE_URL.
 */
export async function runDatabaseMigrations(): Promise<void> {
  if (!isDatabaseConfigEnabled()) {
    return;
  }

  if (!migratePromise) {
    migratePromise = (async () => {
      await ensureMigrationsTable();
      const applied = await appliedMigrationIds();
      const files = await listMigrationFiles();
      for (const file of files) {
        if (applied.has(file)) continue;
        await applyMigrationFile(file);
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
