/**
 * Apply versioned SQL migrations when DATABASE_URL is set.
 * Usage: node scripts/migrate.mjs
 */
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = (process.env.DATABASE_URL ?? "").trim();

if (!url) {
  console.log("DATABASE_URL not set — skipping migrations (file-store mode).");
  process.exit(0);
}

const pool = new pg.Pool({ connectionString: url, max: 1 });

async function main() {
  const client = await pool.connect();
  try {
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
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip ${file}`);
        continue;
      }
      const sql = await readFile(join(dir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING", [file]);
        await client.query("COMMIT");
        console.log(`applied ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
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
