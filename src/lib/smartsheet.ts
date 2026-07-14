import type {
  SmartsheetCell,
  SmartsheetColumn,
  SmartsheetDataset,
  SmartsheetRow,
  SourceConfig,
} from "@/lib/config/types";
import { listConfiguredSmartsheetConnectionKeys } from "@/lib/smartsheet-connection-keys";
import { normalizeSmartsheetApiBaseUrl } from "@/lib/smartsheet-api-url";

export interface ConnectionConfig {
  token: string;
  apiBaseUrl: string;
}

interface SmartsheetApiColumn {
  id: number;
  index: number;
  title: string;
  type?: string;
  columnType?: string;
  /** Present when `include=columnOptions`; may be strings or API-specific objects. */
  options?: unknown;
  locked?: boolean;
}

interface SmartsheetApiRow {
  id: number;
  sheetId?: number;
  cells?: Array<{
    columnId: number;
    value?: unknown;
    displayValue?: string;
    objectValue?: unknown;
    hyperlink?: { url?: string } | null;
  }>;
}

interface SmartsheetApiResponse {
  id: number;
  name: string;
  columns?: SmartsheetApiColumn[];
  rows?: SmartsheetApiRow[];
}

export interface SmartsheetSchemaSummary {
  sourceType: SourceConfig["sourceType"];
  id: number;
  name: string;
  columns: SmartsheetColumn[];
  rowCount: number;
}

interface EffectiveFetchOptions {
  includeObjectValue?: boolean;
  includeColumnOptions?: boolean;
  level?: number;
}

export interface FetchBehaviorOptions {
  fresh?: boolean;
  fetchOptionsOverride?: Partial<SourceConfig["fetchOptions"]>;
}

export class SmartsheetRequestError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(body || `Smartsheet request failed with HTTP ${status}`);
    this.name = "SmartsheetRequestError";
    this.status = status;
    this.body = body;
  }
}

const DEFAULT_SMARTSHEET_CLIENT_ERROR = "Update failed. Try again.";

function sanitizeClientErrorSnippet(text: string, maxLen: number): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) {
    return oneLine;
  }
  return `${oneLine.slice(0, Math.max(0, maxLen - 1))}…`;
}

function appendSmartsheetRefForLogs(message: string, refId: string | undefined, maxLen: number): string {
  const base = sanitizeClientErrorSnippet(message, refId ? Math.max(60, maxLen - 48) : maxLen);
  if (!refId) {
    return base;
  }
  return `${base} (Smartsheet ref: ${refId})`;
}

/**
 * Parses Smartsheet API error bodies for a short, user-safe message.
 * Avoids echoing HTML error pages or huge payloads.
 */
export function extractSmartsheetErrorMessage(body: string | undefined, maxLen = 500): string {
  if (body == null || !String(body).trim()) {
    return DEFAULT_SMARTSHEET_CLIENT_ERROR;
  }
  const raw = String(body).trim();
  if (raw.startsWith("<")) {
    return DEFAULT_SMARTSHEET_CLIENT_ERROR;
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const refId =
      typeof parsed.refId === "string" && parsed.refId.trim() ? parsed.refId.trim() : undefined;
    const fromRoot =
      (typeof parsed.message === "string" && parsed.message.trim()) ||
      (typeof parsed.errorMessage === "string" && parsed.errorMessage.trim()) ||
      "";
    if (fromRoot) {
      return appendSmartsheetRefForLogs(fromRoot, refId, maxLen);
    }
    const errObj = parsed.error;
    if (errObj && typeof errObj === "object" && "message" in errObj) {
      const m = (errObj as { message?: unknown }).message;
      if (typeof m === "string" && m.trim()) {
        return appendSmartsheetRefForLogs(m.trim(), refId, maxLen);
      }
    }
    const result = parsed.result;
    if (Array.isArray(result) && result[0] && typeof result[0] === "object") {
      const first = result[0] as { error?: { message?: string }; message?: string };
      const nested =
        (typeof first.error?.message === "string" && first.error.message.trim()) ||
        (typeof first.message === "string" && first.message.trim()) ||
        "";
      if (nested) {
        return appendSmartsheetRefForLogs(nested, refId, maxLen);
      }
    }
  } catch {
    // not JSON
  }
  if (raw.length <= maxLen && !/[<>]/.test(raw)) {
    return sanitizeClientErrorSnippet(raw, maxLen);
  }
  return DEFAULT_SMARTSHEET_CLIENT_ERROR;
}

/**
 * Row updates use PUT /sheets/{sheetId}/rows. For sheet sources, smartsheetId is the sheet id.
 * For reports, smartsheetId is the report id — we must use each row's sheetId from the API.
 */
export function resolveSheetIdForRowUpdate(
  source: Pick<SourceConfig, "sourceType" | "smartsheetId">,
  row: Pick<SmartsheetRow, "sheetId">,
): number | null {
  if (typeof row.sheetId === "number" && Number.isFinite(row.sheetId) && row.sheetId > 0) {
    return row.sheetId;
  }
  if (source.sourceType === "sheet") {
    return source.smartsheetId;
  }
  return null;
}

/** HTTP status to return to the client for a failed Smartsheet request (contributor API). */
export function httpStatusForSmartsheetContributorError(smartsheetStatus: number): number {
  if (smartsheetStatus === 429) {
    return 429;
  }
  if (smartsheetStatus === 401) {
    return 502;
  }
  if (smartsheetStatus >= 400 && smartsheetStatus < 500) {
    return smartsheetStatus;
  }
  return 502;
}

function parseConnectionsEnv() {
  const raw = process.env.SMARTSHEET_CONNECTIONS_JSON?.trim();
  if (!raw) {
    return new Map<string, ConnectionConfig>();
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, string | { token: string; apiBaseUrl?: string }>;
    return new Map(
      Object.entries(parsed).flatMap(([key, value]) => {
        if (typeof value === "string") {
          return [[key, { token: value, apiBaseUrl: normalizeSmartsheetApiBaseUrl(undefined) } satisfies ConnectionConfig]];
        }
        if (!value?.token) {
          return [];
        }
        return [
          [
            key,
            {
              token: value.token,
              apiBaseUrl: normalizeSmartsheetApiBaseUrl(value.apiBaseUrl),
            } satisfies ConnectionConfig,
          ],
        ];
      })
    );
  } catch (error) {
    throw new Error(
      `SMARTSHEET_CONNECTIONS_JSON is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export function listConfiguredConnectionKeys() {
  return listConfiguredSmartsheetConnectionKeys();
}

export function hasConfiguredConnection() {
  return Boolean(process.env.SMARTSHEET_API_TOKEN?.trim() || process.env.SMARTSHEET_CONNECTIONS_JSON?.trim());
}

export function normalizeColumnKey(value: string) {
  return value.trim().toLowerCase();
}

function resolveConnection(connectionKey = "default", sourceApiBaseUrl?: string): ConnectionConfig {
  const namedConnections = parseConnectionsEnv();
  const keyTrim = (connectionKey ?? "").trim();
  const key = keyTrim || "default";

  if (key !== "default" && !namedConnections.has(key)) {
    throw new Error(
      `Unknown Smartsheet connectionKey "${key}". Add it to SMARTSHEET_CONNECTIONS_JSON or clear connectionKey to use the default token.`,
    );
  }

  const named = namedConnections.get(key);
  if (named) {
    const base = sourceApiBaseUrl?.trim() || named.apiBaseUrl;
    return {
      token: named.token,
      apiBaseUrl: normalizeSmartsheetApiBaseUrl(base),
    };
  }

  const token = process.env.SMARTSHEET_API_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "No Smartsheet API token is configured. Set SMARTSHEET_API_TOKEN or SMARTSHEET_CONNECTIONS_JSON."
    );
  }

  const base = sourceApiBaseUrl?.trim() || process.env.SMARTSHEET_API_BASE_URL?.trim();
  return {
    token,
    apiBaseUrl: normalizeSmartsheetApiBaseUrl(base),
  };
}

function resolveFetchOptions(source: SourceConfig, options?: FetchBehaviorOptions): EffectiveFetchOptions {
  return {
    includeObjectValue: options?.fetchOptionsOverride?.includeObjectValue ?? source.fetchOptions?.includeObjectValue,
    includeColumnOptions:
      options?.fetchOptionsOverride?.includeColumnOptions ?? source.fetchOptions?.includeColumnOptions,
    level: options?.fetchOptionsOverride?.level ?? source.fetchOptions?.level,
  };
}

function buildIncludeList(fetchOptions: EffectiveFetchOptions) {
  const includes = new Set<string>(["columnType"]);
  if (fetchOptions.includeColumnOptions !== false) {
    includes.add("columnOptions");
  }
  if (fetchOptions.includeObjectValue !== false) {
    includes.add("objectValue");
  }
  return [...includes];
}

function normalizePicklistOptionsFromApi(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) {
    return undefined;
  }
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      if (item.length > 0) {
        out.push(item);
      }
      continue;
    }
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const s =
        typeof o.value === "string"
          ? o.value
          : typeof o.name === "string"
            ? o.name
            : typeof o.label === "string"
              ? o.label
              : null;
      if (s && s.trim()) {
        out.push(s.trim());
      }
    }
  }
  return out.length > 0 ? out : undefined;
}

function normalizeColumns(columns: SmartsheetApiColumn[]): SmartsheetColumn[] {
  return columns.map((column) => ({
    id: column.id,
    index: column.index,
    title: column.title,
    type: column.type ?? column.columnType ?? "TEXT_NUMBER",
    options: normalizePicklistOptionsFromApi(column.options),
    locked: column.locked,
  }));
}

function normalizeRows(rows: SmartsheetApiRow[], columns: SmartsheetColumn[]): SmartsheetRow[] {
  const columnsById = new Map(columns.map((column) => [column.id, column]));

  return rows.map((row) => {
    const cellsById: Record<number, SmartsheetCell> = {};
    const cellsByTitle: Record<string, SmartsheetCell> = {};

    for (const cell of row.cells ?? []) {
      const column = columnsById.get(cell.columnId);
      if (!column) {
        continue;
      }

      const normalizedCell: SmartsheetCell = {
        columnId: column.id,
        columnTitle: column.title,
        columnType: column.type,
        value: cell.value,
        displayValue: cell.displayValue,
        objectValue: cell.objectValue,
        hyperlink: cell.hyperlink,
      };

      cellsById[column.id] = normalizedCell;
      cellsByTitle[normalizeColumnKey(column.title)] = normalizedCell;
    }

    return {
      id: row.id,
      sheetId: row.sheetId,
      cellsById,
      cellsByTitle,
    };
  });
}

async function fetchSmartsheetSource<T>(
  endpointPath: string,
  source: SourceConfig,
  revalidateSeconds: number,
  options?: FetchBehaviorOptions,
) {
  const { token, apiBaseUrl } = resolveConnection(source.connectionKey, source.apiBaseUrl);
  const url = new URL(`${apiBaseUrl.replace(/\/$/, "")}/${endpointPath.replace(/^\//, "")}`);
  const fetchOptions = resolveFetchOptions(source, options);
  url.searchParams.set("include", buildIncludeList(fetchOptions).join(","));

  if (fetchOptions.level) {
    url.searchParams.set("level", String(fetchOptions.level));
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: revalidateSeconds > 0 ? "force-cache" : "no-store",
    next: revalidateSeconds > 0 ? { revalidate: revalidateSeconds } : { revalidate: 0 },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new SmartsheetRequestError(response.status, body);
  }

  return (await response.json()) as T;
}

async function fetchCurrentUser(connection: ConnectionConfig) {
  return fetch(`${connection.apiBaseUrl.replace(/\/$/, "")}/users/me`, {
    headers: { Authorization: `Bearer ${connection.token}` },
    signal: AbortSignal.timeout(5000),
    next: { revalidate: 60 },
  } as RequestInit);
}

function resolveRevalidateSeconds(source: SourceConfig, options?: FetchBehaviorOptions) {
  return options?.fresh ? 0 : source.cacheTtlSeconds ?? 120;
}

export async function getSmartsheetSchema(source: SourceConfig, options?: FetchBehaviorOptions): Promise<SmartsheetSchemaSummary> {
  const response = await fetchSmartsheetSource<SmartsheetApiResponse>(
    `${source.sourceType === "report" ? "reports" : "sheets"}/${source.smartsheetId}`,
    source,
    resolveRevalidateSeconds(source, options),
    options,
  );
  const columns = normalizeColumns(response.columns ?? []);

  return {
    sourceType: source.sourceType,
    id: response.id,
    name: response.name,
    columns,
    rowCount: response.rows?.length ?? 0,
  };
}

export async function getSmartsheetDataset(source: SourceConfig, options?: FetchBehaviorOptions) {
  return buildDataset(source, resolveRevalidateSeconds(source, options), options);
}

async function buildDataset(
  source: SourceConfig,
  revalidateSeconds: number,
  options?: FetchBehaviorOptions,
): Promise<SmartsheetDataset> {
  const response = await fetchSmartsheetSource<SmartsheetApiResponse>(
    `${source.sourceType === "report" ? "reports" : "sheets"}/${source.smartsheetId}`,
    source,
    revalidateSeconds,
    options,
  );
  const columns = normalizeColumns(response.columns ?? []);
  const rows = normalizeRows(response.rows ?? [], columns);

  return {
    sourceType: source.sourceType,
    id: response.id,
    name: response.name,
    columns,
    rows,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Smartsheet error 1008 ("Unable to parse request") often comes from cells that mix
 * `value` + `objectValue` or include JSON `null` in a way the API rejects. Send only one
 * payload shape per cell.
 */
export function normalizeCellsForSmartsheetRowUpdate(
  cells: Array<{ columnId: number; value?: unknown; objectValue?: unknown }>,
): Array<{ columnId: number; value?: unknown } | { columnId: number; objectValue: unknown }> {
  return cells.map((cell) => {
    const columnId = cell.columnId;
    const hasObject = cell.objectValue !== undefined && cell.objectValue !== null;
    if (hasObject) {
      return { columnId, objectValue: cell.objectValue };
    }
    const v = cell.value;
    return { columnId, value: v === undefined || v === null ? "" : v };
  });
}

/** Raw list from MULTI_CONTACT objectValue: API uses `values`; accept mistaken `value` (legacy) when reading. */
function multiContactEntriesFromObject(o: Record<string, unknown>): unknown[] {
  if (Array.isArray(o.values)) {
    return o.values as unknown[];
  }
  if (Array.isArray(o.value)) {
    return o.value as unknown[];
  }
  return [];
}

function contactObjectValueToSmartsheetScalar(objectValue: unknown): string {
  if (objectValue == null || typeof objectValue !== "object") {
    return "";
  }
  const ov = objectValue as Record<string, unknown>;
  if (ov.objectType === "CONTACT") {
    if (typeof ov.email === "string" && ov.email.trim()) {
      return ov.email.trim();
    }
    if (typeof ov.name === "string" && ov.name.trim()) {
      return ov.name.trim();
    }
    return "";
  }
  if (ov.objectType === "MULTI_CONTACT") {
    return multiContactEntriesFromObject(ov)
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return "";
        }
        const c = entry as Record<string, unknown>;
        if (typeof c.email === "string" && c.email.trim()) {
          return c.email.trim();
        }
        if (typeof c.name === "string" && c.name.trim()) {
          return c.name.trim();
        }
        return "";
      })
      .filter(Boolean)
      .join(", ");
  }
  return "";
}

function stringifyCellScalar(cell: { value?: unknown }): string {
  const v = cell.value;
  if (v === undefined || v === null) {
    return "";
  }
  return String(v).trim();
}

const SMARTSHEET_CONTACT_COLUMN_TYPES = new Set(["CONTACT_LIST", "MULTI_CONTACT_LIST"]);

/** Smartsheet MULTI_PICKLIST writes require `objectValue`; plain `value` fails CELL_VALUE_FAILS_VALIDATION under strict parsing. */
function sanitizeMultiPicklistObjectValue(ov: unknown): {
  objectType: "MULTI_PICKLIST";
  values: string[];
} {
  if (ov == null || typeof ov !== "object") {
    return { objectType: "MULTI_PICKLIST", values: [] };
  }
  const o = ov as Record<string, unknown>;
  if (o.objectType !== "MULTI_PICKLIST") {
    return { objectType: "MULTI_PICKLIST", values: [] };
  }
  const raw = o.values;
  if (!Array.isArray(raw)) {
    return { objectType: "MULTI_PICKLIST", values: [] };
  }
  const values = raw
    .map((v) => (typeof v === "string" ? v.trim() : String(v ?? "").trim()))
    .filter(Boolean);
  return { objectType: "MULTI_PICKLIST", values };
}

/**
 * Smartsheet rejects bare `{ objectType: "CONTACT" }` (no email/name) under strict objectValue parsing → 1008.
 * For CONTACT_LIST, clearing uses `{ value: "" }` per API cell reference.
 */
function isPopulatedContactObjectValue(ov: unknown): boolean {
  if (ov == null || typeof ov !== "object") {
    return false;
  }
  const o = ov as Record<string, unknown>;
  if (o.objectType !== "CONTACT") {
    return false;
  }
  const email = typeof o.email === "string" ? o.email.trim() : "";
  const name = typeof o.name === "string" ? o.name.trim() : "";
  return Boolean(email || name);
}

/** Drop empty CONTACT entries and emit API-correct `{ objectType, values }` for MULTI_CONTACT_LIST writes. */
function sanitizeMultiContactObjectValue(ov: unknown): {
  objectType: "MULTI_CONTACT";
  values: Array<{ objectType: "CONTACT"; email?: string; name?: string }>;
} {
  if (ov == null || typeof ov !== "object") {
    return { objectType: "MULTI_CONTACT", values: [] };
  }
  const o = ov as Record<string, unknown>;
  if (o.objectType !== "MULTI_CONTACT") {
    return { objectType: "MULTI_CONTACT", values: [] };
  }
  const rawEntries = multiContactEntriesFromObject(o);
  const values: Array<{ objectType: "CONTACT"; email?: string; name?: string }> = [];
  for (const entry of rawEntries) {
    if (entry == null || typeof entry !== "object") {
      continue;
    }
    const c = entry as Record<string, unknown>;
    if (c.objectType !== "CONTACT") {
      continue;
    }
    const email = typeof c.email === "string" ? c.email.trim() : "";
    const name = typeof c.name === "string" ? c.name.trim() : "";
    if (!email && !name) {
      continue;
    }
    if (email && name) {
      values.push({ objectType: "CONTACT", email, name });
    } else if (email) {
      values.push({ objectType: "CONTACT", email });
    } else {
      values.push({ objectType: "CONTACT", name });
    }
  }
  return { objectType: "MULTI_CONTACT", values };
}

/**
 * Build Smartsheet row-update cells for `PUT /sheets/{id}/rows`.
 *
 * - **TEXT_NUMBER / PICKLIST / PHONE:** `{ columnId, value }`. Smartsheet defaults to **strict** cell parsing
 *   (`strict: true`); we do not send `strict: false`, so PICKLIST text must match column options.
 * - **MULTI_PICKLIST:** `{ columnId, objectValue }` with `{ objectType: "MULTI_PICKLIST", values: string[] }`.
 *   Comma/semicolon-separated `value` from the contributor form is split and rewritten to this shape.
 * - **MULTI_CONTACT_LIST:** `{ columnId, objectValue }` with `{ objectType: "MULTI_CONTACT", values: [...] }`
 *   (REST + official SDKs use the plural **`values`** array, not `value`).
 * - **CONTACT_LIST:** `{ objectValue }` when setting a contact; **`{ value: "" }`** when clearing (bare
 *   `{ objectType: "CONTACT" }` without email/name often yields error **1008**).
 */
export function formatCellsForSmartsheetRowPut(
  cells: Array<{ columnId: number; value?: unknown; objectValue?: unknown }>,
  columnTypeById: Map<number, string>,
): Array<{ columnId: number; value: unknown } | { columnId: number; objectValue: unknown }> {
  const normalized = normalizeCellsForSmartsheetRowUpdate(cells);
  const mapped = normalized.map((cell) => {
    const columnId = cell.columnId;
    const columnType = columnTypeById.get(columnId) ?? "";

    if (SMARTSHEET_CONTACT_COLUMN_TYPES.has(columnType)) {
      if (columnType === "MULTI_CONTACT_LIST") {
        if ("objectValue" in cell) {
          const sanitized = sanitizeMultiContactObjectValue(cell.objectValue);
          // Smartsheet error 1012: MULTI_CONTACT objectValue requires non-empty values array.
          // Clear via value: "" (same mechanism as CONTACT_LIST).
          if (sanitized.values.length === 0) {
            return { columnId, value: "" };
          }
          return { columnId, objectValue: sanitized };
        }
        const s = stringifyCellScalar(cell);
        if (!s) {
          return { columnId, value: "" };
        }
        const tokens = s.split(/[,;]+/).map((t) => t.trim()).filter(Boolean);
        const values = tokens.map((token) =>
          token.includes("@")
            ? { objectType: "CONTACT" as const, email: token }
            : { objectType: "CONTACT" as const, name: token },
        );
        return { columnId, objectValue: { objectType: "MULTI_CONTACT", values } };
      }

      // CONTACT_LIST
      if ("objectValue" in cell) {
        if (!isPopulatedContactObjectValue(cell.objectValue)) {
          return { columnId, value: "" };
        }
        return { columnId, objectValue: cell.objectValue };
      }
      const s = stringifyCellScalar(cell);
      if (!s) {
        return { columnId, value: "" };
      }
      return {
        columnId,
        objectValue: s.includes("@")
          ? { objectType: "CONTACT", email: s }
          : { objectType: "CONTACT", name: s },
      };
    }

    if (columnType === "MULTI_PICKLIST") {
      if ("objectValue" in cell) {
        const sanitized = sanitizeMultiPicklistObjectValue(cell.objectValue);
        if (sanitized.values.length === 0) {
          return { columnId, value: "" };
        }
        return { columnId, objectValue: sanitized };
      }
      const s = stringifyCellScalar(cell);
      if (!s) {
        return { columnId, value: "" };
      }
      const parts = s
        .split(/[,;\n]+/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length === 0) {
        return { columnId, value: "" };
      }
      return { columnId, objectValue: { objectType: "MULTI_PICKLIST", values: parts } };
    }

    if ("objectValue" in cell) {
      return { columnId, value: contactObjectValueToSmartsheetScalar(cell.objectValue) };
    }
    return { columnId, value: cell.value ?? "" };
  });

  return mapped;
}

export async function updateSmartsheetRow(
  source: SourceConfig,
  sheetId: number,
  rowId: number,
  cells: Array<{ columnId: number; value?: unknown; objectValue?: unknown }>,
  columnTypeById: Map<number, string>,
) {
  const { token, apiBaseUrl } = resolveConnection(source.connectionKey, source.apiBaseUrl);
  const url = `${apiBaseUrl.replace(/\/$/, "")}/sheets/${sheetId}/rows`;
  const outgoingCells = formatCellsForSmartsheetRowPut(cells, columnTypeById);
  console.log(
    `[updateSmartsheetRow] PUT sheet=${sheetId} row=${rowId} cellCount=${outgoingCells.length}`,
  );
  const putBody = JSON.stringify([{ id: rowId, cells: outgoingCells }]);
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    body: putBody,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new SmartsheetRequestError(response.status, body);
  }
}

export async function testSourceConnection(source: SourceConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    const connection = resolveConnection(source.connectionKey, source.apiBaseUrl);
    const response = await fetchCurrentUser(connection);
    if (!response.ok) {
      return { ok: false, error: `Smartsheet returned HTTP ${response.status}.` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export interface SmartsheetCatalogItem {
  id: number;
  name: string;
}

/**
 * Lists sheets or reports visible to a connection — for admin source pickers.
 */
export async function listSmartsheetCatalog(
  kind: "sheet" | "report",
  options?: { connectionKey?: string; apiBaseUrl?: string },
): Promise<SmartsheetCatalogItem[]> {
  const { token, apiBaseUrl } = resolveConnection(options?.connectionKey, options?.apiBaseUrl);
  const base = apiBaseUrl.replace(/\/$/, "");
  const path = kind === "report" ? "reports" : "sheets";
  const items: SmartsheetCatalogItem[] = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const url = new URL(`${base}/${path}`);
    url.searchParams.set("pageSize", String(pageSize));
    url.searchParams.set("page", String(page));
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new SmartsheetRequestError(response.status, body);
    }
    const data = (await response.json()) as {
      data?: Array<{ id?: number; name?: string }>;
      totalPages?: number;
    };
    for (const row of data.data ?? []) {
      if (typeof row.id === "number" && typeof row.name === "string" && row.name.trim()) {
        items.push({ id: row.id, name: row.name.trim() });
      }
    }
    const totalPages = data.totalPages ?? 1;
    if (page >= totalPages) break;
    page += 1;
  }

  return items.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

/**
 * Verifies that the default Smartsheet connection can reach the API.
 * Returns true if the token is valid, false otherwise (never throws).
 * Result is cached for 60 seconds so the home page status indicator
 * does not make a live API call on every request.
 */
export async function testSmartsheetConnection(): Promise<boolean> {
  if (!hasConfiguredConnection()) {
    return false;
  }
  try {
    let conn: ConnectionConfig;
    try {
      conn = resolveConnection();
    } catch {
      const named = parseConnectionsEnv();
      const first = named.values().next().value as ConnectionConfig | undefined;
      if (!first) return false;
      conn = {
        token: first.token,
        apiBaseUrl: normalizeSmartsheetApiBaseUrl(first.apiBaseUrl),
      };
    }
    const response = await fetchCurrentUser(conn);
    return response.ok;
  } catch {
    return false;
  }
}
