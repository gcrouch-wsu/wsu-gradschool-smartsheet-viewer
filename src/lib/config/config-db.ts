import { connect } from "node:net";
import { Pool } from "pg";
import type { PublicPageSummary, SourceConfig, ViewConfig } from "@/lib/config/types";
import { normalizePublishedSlug } from "@/lib/slug-normalize";
import { humanizeSlug } from "@/lib/utils";
import { validateSourceConfig, validateViewConfig } from "@/lib/config/validation";
import { createDatabaseUnavailableError, isDatabaseConnectionFailure } from "@/lib/database-unavailable";
import { buildPgPoolOptions } from "@/lib/pg-connection";

const DATABASE_URL_ENV_VAR = "DATABASE_URL";

const globalForDb = globalThis as unknown as {
  __smartsheetsViewConfigPool?: Pool;
  __smartsheetsViewDbReachableUntil?: number;
  __smartsheetsViewDbReachableUrl?: string;
};

function getDatabaseUrl(): string | null {
  return process.env[DATABASE_URL_ENV_VAR]?.trim() ?? null;
}

function getPool(): Pool {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error(`${DATABASE_URL_ENV_VAR} is required for database config storage.`);
  }
  if (!globalForDb.__smartsheetsViewConfigPool) {
    const { connectionString, ssl } = buildPgPoolOptions(url);
    const pool = new Pool({
      connectionString,
      max: 2,
      connectionTimeoutMillis: 10_000,
      ...(ssl ? { ssl } : {}),
    });
    globalForDb.__smartsheetsViewConfigPool = pool;
  }
  const pool = globalForDb.__smartsheetsViewConfigPool;
  if (pool.listenerCount("error") === 0) {
    pool.on("error", () => {
      // Idle disconnects are reported by the next query.
    });
  }
  return pool;
}

const PROBE_TIMEOUT_MS = 1_500;
const REACHABLE_TTL_MS = 30_000;

function databaseEndpoint(rawUrl: string): { host: string; port: number } | null {
  try {
    const parsed = new URL(buildPgPoolOptions(rawUrl).connectionString);
    const host = parsed.hostname.replace(/^\[|\]$/g, "");
    if (!host) return null;
    const port = parsed.port ? Number(parsed.port) : 5432;
    if (!Number.isFinite(port)) return null;
    return { host, port };
  } catch {
    return null;
  }
}

function probePort(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    const finish = (reachable: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(reachable);
    };
    socket.setTimeout(PROBE_TIMEOUT_MS);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

/** Fail before `pg` connects. Its refusal error crashes the Next.js dev overlay. */
async function assertDatabaseReachable(rawUrl: string) {
  const now = Date.now();
  if (
    globalForDb.__smartsheetsViewDbReachableUrl === rawUrl &&
    (globalForDb.__smartsheetsViewDbReachableUntil ?? 0) > now
  ) {
    return;
  }

  const endpoint = databaseEndpoint(rawUrl);
  if (!endpoint) return;

  const hosts = endpoint.host === "localhost" ? ["127.0.0.1", "::1"] : [endpoint.host];
  for (const host of hosts) {
    if (await probePort(host, endpoint.port)) {
      globalForDb.__smartsheetsViewDbReachableUrl = rawUrl;
      globalForDb.__smartsheetsViewDbReachableUntil = Date.now() + REACHABLE_TTL_MS;
      return;
    }
  }
  throw createDatabaseUnavailableError();
}

export async function queryConfigDb<T = unknown>(text: string, params?: readonly unknown[]) {
  const url = getDatabaseUrl();
  if (url) {
    await assertDatabaseReachable(url);
  }
  try {
    const result = await getPool().query(text, params as unknown[]);
    return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
  } catch (error) {
    if (isDatabaseConnectionFailure(error)) {
      globalForDb.__smartsheetsViewDbReachableUntil = 0;
      throw createDatabaseUnavailableError();
    }
    throw error;
  }
}

/** Ensures platform tables exist via versioned migrations (no-op without DATABASE_URL). */
export async function ensureConfigTables() {
  const { runDatabaseMigrations } = await import("@/lib/db-migrations");
  await runDatabaseMigrations();
}

function parseSourceConfig(value: unknown, id: string): SourceConfig {
  const result = validateSourceConfig(value);
  if (!result.success || !result.data) {
    throw new Error(`Invalid source config ${id}: ${result.errors.join(" ")}`);
  }
  return result.data;
}

function parseViewConfig(value: unknown, id: string, knownSourceIds: string[], sources: SourceConfig[]): ViewConfig {
  const result = validateViewConfig(value, { knownSourceIds, sources });
  if (!result.success || !result.data) {
    throw new Error(`Invalid view config ${id}: ${result.errors.join(" ")}`);
  }
  return result.data;
}

export async function listSourceConfigs(): Promise<SourceConfig[]> {
  await ensureConfigTables();
  const { rows } = await queryConfigDb<{ id: string; data: unknown }>("SELECT id, data FROM config_sources ORDER BY id");
  return rows.map((row) => parseSourceConfig(row.data, row.id));
}

export async function listViewConfigs(): Promise<ViewConfig[]> {
  const sources = await listSourceConfigs();
  const knownSourceIds = sources.map((s) => s.id);
  await ensureConfigTables();
  const { rows } = await queryConfigDb<{ id: string; data: unknown }>("SELECT id, data FROM config_views ORDER BY id");
  return rows.map((row) => parseViewConfig(row.data, row.id, knownSourceIds, sources));
}

export async function getSourceConfigById(sourceId: string): Promise<SourceConfig | null> {
  await ensureConfigTables();
  const { rows } = await queryConfigDb<{ id: string; data: unknown }>("SELECT id, data FROM config_sources WHERE id = $1", [
    sourceId,
  ]);
  const row = rows[0];
  return row ? parseSourceConfig(row.data, row.id) : null;
}

export async function getViewConfigById(viewId: string): Promise<ViewConfig | null> {
  const sources = await listSourceConfigs();
  const knownSourceIds = sources.map((s) => s.id);
  await ensureConfigTables();
  const { rows } = await queryConfigDb<{ id: string; data: unknown }>("SELECT id, data FROM config_views WHERE id = $1", [
    viewId,
  ]);
  const row = rows[0];
  return row ? parseViewConfig(row.data, row.id, knownSourceIds, sources) : null;
}

export async function getPublicViewsBySlug(slug: string, options?: { includePrivate?: boolean }): Promise<ViewConfig[]> {
  const views = await listViewConfigs();
  const slugNorm = normalizePublishedSlug(slug);
  return views
    .filter((v) => (options?.includePrivate || v.public) && normalizePublishedSlug(v.slug) === slugNorm)
    .sort((a, b) => (a.tabOrder ?? 999) - (b.tabOrder ?? 999) || (a.label ?? "").localeCompare(b.label ?? ""));
}

export async function listPublicPageSummaries(): Promise<PublicPageSummary[]> {
  const [sources, views] = await Promise.all([listSourceConfigs(), listViewConfigs()]);
  const sourcesById = new Map(sources.map((s) => [s.id, s]));
  const groups = new Map<string, ViewConfig[]>();

  for (const view of views.filter((v) => v.public)) {
    const key = normalizePublishedSlug(view.slug);
    const existing = groups.get(key) ?? [];
    existing.push(view);
    groups.set(key, existing);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([slug, groupedViews]) => {
      const sorted = [...groupedViews].sort(
        (a, b) => (a.tabOrder ?? 999) - (b.tabOrder ?? 999) || (a.label ?? "").localeCompare(b.label ?? "")
      );
      const distinctSourceIds = [...new Set(sorted.map((view) => view.sourceId).filter(Boolean))];
      if (distinctSourceIds.length > 1) {
        console.warn(
          `[smartsheets_view] Slug "${slug}" is published for multiple sources (${distinctSourceIds.join(", ")}). Skipping it from the public summary list.`
        );
        return [];
      }
      const sourceId = sorted[0]?.sourceId ?? "";
      const sourceLabel = sourcesById.get(sourceId)?.label ?? sourceId;
      return [{
        slug,
        title: humanizeSlug(slug),
        sourceId,
        sourceLabel,
        views: sorted.map((v) => ({ id: v.id, label: v.label, description: v.description })),
      }];
    });
}

export async function saveSourceConfig(config: SourceConfig): Promise<void> {
  const result = validateSourceConfig(config);
  if (!result.success || !result.data) {
    throw new Error(result.errors.join(" "));
  }
  await ensureConfigTables();
  await queryConfigDb(
    `INSERT INTO config_sources (id, data) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET data = $2`,
    [result.data.id, JSON.stringify(result.data)]
  );
}

export async function saveViewConfig(config: ViewConfig): Promise<void> {
  const sources = await listSourceConfigs();
  const result = validateViewConfig(config, { knownSourceIds: sources.map((s) => s.id), sources });
  if (!result.success || !result.data) {
    throw new Error(result.errors.join(" "));
  }
  await ensureConfigTables();
  await queryConfigDb(
    `INSERT INTO config_views (id, data) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET data = $2`,
    [result.data.id, JSON.stringify(result.data)]
  );
}

export async function deleteSourceConfig(sourceId: string): Promise<void> {
  await ensureConfigTables();
  await queryConfigDb("DELETE FROM config_sources WHERE id = $1", [sourceId]);
}

export async function deleteViewConfig(viewId: string): Promise<void> {
  await ensureConfigTables();
  await queryConfigDb("DELETE FROM config_views WHERE id = $1", [viewId]);
}

export async function updateViewPublication(viewId: string, isPublic: boolean): Promise<ViewConfig> {
  const view = await getViewConfigById(viewId);
  if (!view) {
    throw new Error(`View "${viewId}" was not found.`);
  }
  const updated = { ...view, public: isPublic };
  await saveViewConfig(updated);
  return updated;
}

/** True when `DATABASE_URL` is set (Postgres-backed config and contributor auth). */
export function isDatabaseConfigEnabled(): boolean {
  return !!getDatabaseUrl();
}
