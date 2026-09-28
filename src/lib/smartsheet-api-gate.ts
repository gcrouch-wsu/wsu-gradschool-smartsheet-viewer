/**
 * Admin kill switch for outbound Smartsheet API calls.
 * Stored in Postgres `app_settings`; without DATABASE_URL the API stays enabled.
 * Uses dynamic imports for config-db so client bundles never pull in `pg`.
 */

export const SMARTSHEET_API_ENABLED_KEY = "smartsheet_api_enabled";
export const SMARTSHEET_API_DISABLED_MESSAGE = "Smartsheet API is disabled by an administrator.";

const CACHE_TTL_MS = 5_000;

export class SmartsheetApiDisabledError extends Error {
  readonly status = 503;

  constructor(message = SMARTSHEET_API_DISABLED_MESSAGE) {
    super(message);
    this.name = "SmartsheetApiDisabledError";
  }
}

type CacheEntry = { enabled: boolean; expiresAt: number };

const globalForGate = globalThis as unknown as {
  __smartsheetApiEnabledCache?: CacheEntry;
};

function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function readCache(): boolean | null {
  const entry = globalForGate.__smartsheetApiEnabledCache;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) return null;
  return entry.enabled;
}

function writeCache(enabled: boolean) {
  globalForGate.__smartsheetApiEnabledCache = {
    enabled,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
}

export function clearSmartsheetApiEnabledCache() {
  globalForGate.__smartsheetApiEnabledCache = undefined;
}

/** True when outbound Smartsheet calls are allowed. Default on; no-DB → on. */
export async function isSmartsheetApiEnabled(): Promise<boolean> {
  if (!isDatabaseConfigured()) {
    return true;
  }

  const cached = readCache();
  if (cached !== null) {
    return cached;
  }

  try {
    const { queryConfigDb } = await import("@/lib/config/config-db");
    const { runDatabaseMigrations } = await import("@/lib/db-migrations");
    await runDatabaseMigrations();
    const { rows } = await queryConfigDb<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = $1",
      [SMARTSHEET_API_ENABLED_KEY],
    );
    const raw = rows[0]?.value?.trim().toLowerCase();
    const enabled = raw !== "false";
    writeCache(enabled);
    return enabled;
  } catch {
    // Fail open if settings cannot be read so a DB blip does not brick the app.
    return true;
  }
}

export async function setSmartsheetApiEnabled(enabled: boolean): Promise<void> {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is required to change the Smartsheet API setting.");
  }

  const { queryConfigDb } = await import("@/lib/config/config-db");
  const { runDatabaseMigrations } = await import("@/lib/db-migrations");
  await runDatabaseMigrations();
  await queryConfigDb(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [SMARTSHEET_API_ENABLED_KEY, enabled ? "true" : "false"],
  );
  writeCache(enabled);
}

export async function assertSmartsheetApiEnabled(): Promise<void> {
  if (!(await isSmartsheetApiEnabled())) {
    throw new SmartsheetApiDisabledError();
  }
}
