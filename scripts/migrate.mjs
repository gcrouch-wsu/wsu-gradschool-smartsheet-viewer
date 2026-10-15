/**
 * Apply the single platform schema baseline when DATABASE_URL is set.
 * Usage: node scripts/migrate.mjs
 *
 * Plain `node` does not load `.env` (Next.js does). Load it here so
 * process.env.DATABASE_URL works locally. Optional: `node --env-file=.env scripts/migrate.mjs`
 *
 * `001_platform_schema.sql` is the only migration file. It is always re-applied
 * (idempotent) so schema updates reach databases that already recorded an older 001.
 * Former incremental files are marked superseded in schema_migrations for history.
 */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.loadEnvFile(join(root, ".env"));
} catch {
  // .env missing is fine when DATABASE_URL is already in the environment.
}

const url = (process.env.DATABASE_URL ?? "").trim();

if (!url) {
  console.log("DATABASE_URL not set — skipping migrations (file-store mode).");
  process.exit(0);
}

const BASELINE = "001_platform_schema.sql";
/** Former incremental migrations folded into 001; keep history rows if present. */
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
];

console.log("Connecting to database…");
const pool = new pg.Pool({
  connectionString: url,
  max: 1,
  connectionTimeoutMillis: 15_000,
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("Connected. Checking migrations…");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const sql = await readFile(join(root, "migrations", BASELINE), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING", [
        BASELINE,
      ]);
      await client.query("COMMIT");
      console.log(`reapplied ${BASELINE}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }

    for (const file of SUPERSEDED) {
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING", [
        file,
      ]);
    }
    console.log("Migrations complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
