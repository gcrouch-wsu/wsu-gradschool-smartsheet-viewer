/**
 * Apply versioned SQL migrations when DATABASE_URL is set.
 * Usage: node scripts/migrate.mjs
 *
 * Plain `node` does not load `.env` (Next.js does). Load it here so
 * process.env.DATABASE_URL works locally. Optional: `node --env-file=.env scripts/migrate.mjs`
 *
 * `001_platform_schema.sql` is the consolidated, idempotent baseline and is
 * always re-applied so schema updates in that file reach databases that already
 * recorded an older 001. Other numbered files run once via schema_migrations.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  // Node 20.12+ / 21.7+: built-in .env loader (no dotenv package).
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
  "003_admin_coordinator_role.sql",
  "004_programs_team_contact_changes.sql",
  "005_form_pdf_mapping.sql",
];

console.log("Connecting to database…");
const pool = new pg.Pool({
  connectionString: url,
  max: 1,
  connectionTimeoutMillis: 15_000,
});

async function applySql(client, file, sql, { force = false, applied }) {
  if (!force && applied.has(file)) {
    console.log(`skip ${file}`);
    return;
  }
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING", [file]);
    await client.query("COMMIT");
    console.log(force && applied.has(file) ? `reapplied ${file}` : `applied ${file}`);
    applied.add(file);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

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
    const { rows } = await client.query("SELECT id FROM schema_migrations");
    const applied = new Set(rows.map((r) => r.id));
    const dir = join(root, "migrations");
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

    const baselinePath = join(dir, BASELINE);
    const baselineSql = await readFile(baselinePath, "utf8");
    await applySql(client, BASELINE, baselineSql, { force: true, applied });

    for (const file of SUPERSEDED) {
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING", [file]);
      if (!applied.has(file)) {
        console.log(`marked superseded ${file}`);
        applied.add(file);
      }
    }

    for (const file of files) {
      if (file === BASELINE) continue;
      if (SUPERSEDED.includes(file)) {
        console.log(`skip ${file} (folded into ${BASELINE})`);
        continue;
      }
      const sql = await readFile(join(dir, file), "utf8");
      await applySql(client, file, sql, { force: false, applied });
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
