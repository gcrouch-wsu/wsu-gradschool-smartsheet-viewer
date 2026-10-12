import { isDatabaseConfigEnabled, queryConfigDb } from "@/lib/config/config-db";
import { runDatabaseMigrations } from "@/lib/db-migrations";

export async function ensureSheetTables(): Promise<boolean> {
  if (!isDatabaseConfigEnabled()) return false;
  await runDatabaseMigrations();
  return true;
}

export async function querySheetsDb<T = unknown>(text: string, params?: readonly unknown[]) {
  await ensureSheetTables();
  return queryConfigDb<T>(text, params);
}

export function sheetsDbEnabled(): boolean {
  return isDatabaseConfigEnabled();
}
