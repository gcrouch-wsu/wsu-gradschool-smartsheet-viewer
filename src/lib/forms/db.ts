import { isDatabaseConfigEnabled, queryConfigDb } from "@/lib/config/config-db";

export { queryConfigDb as queryFormsDb };

/** Ensures Forms tables exist via versioned migrations (no-op without DATABASE_URL). */
export async function ensureFormsTables() {
  if (!isFormsDatabaseEnabled()) {
    return;
  }
  const { runDatabaseMigrations } = await import("@/lib/db-migrations");
  await runDatabaseMigrations();
}

/** True when `DATABASE_URL` is set (Postgres-backed forms storage). */
export function isFormsDatabaseEnabled(): boolean {
  return isDatabaseConfigEnabled();
}
