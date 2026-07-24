/**
 * Canonical Smartsheet HTTP client: connection resolution, requests, pagination.
 * Viewer (`smartsheet.ts`) and Forms (`forms/smartsheet-api.ts`) both use this layer.
 */
import { listConfiguredSmartsheetConnectionKeys } from "@/lib/smartsheet-connection-keys";
import { normalizeSmartsheetApiBaseUrl } from "@/lib/smartsheet-api-url";

export interface ConnectionConfig {
  token: string;
  apiBaseUrl: string;
}

export class SmartsheetRequestError extends Error {
  status: number;
  body: string;
  smartsheetErrorCode?: unknown;

  constructor(status: number, body: string, smartsheetErrorCode?: unknown) {
    super(body || `Smartsheet request failed with HTTP ${status}`);
    this.name = "SmartsheetRequestError";
    this.status = status;
    this.body = body;
    this.smartsheetErrorCode = smartsheetErrorCode;
  }
}

function parseConnectionsEnv(): Map<string, ConnectionConfig> {
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
      }),
    );
  } catch (error) {
    throw new Error(
      `SMARTSHEET_CONNECTIONS_JSON is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export function listConfiguredConnectionKeys() {
  return listConfiguredSmartsheetConnectionKeys();
}

/** True when any supported token env is set (viewer or forms alias). */
export function hasConfiguredConnection() {
  return Boolean(
    process.env.SMARTSHEET_API_TOKEN?.trim() ||
      process.env.SMARTSHEET_TOKEN?.trim() ||
      process.env.SMARTSHEET_CONNECTIONS_JSON?.trim(),
  );
}

/**
 * Resolve token + base URL for a connection key.
 * Accepts SMARTSHEET_API_TOKEN or SMARTSHEET_TOKEN (forms alias) for the default key.
 */
export function resolveConnection(connectionKey = "default", sourceApiBaseUrl?: string): ConnectionConfig {
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

  const token =
    process.env.SMARTSHEET_API_TOKEN?.trim() || process.env.SMARTSHEET_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "No Smartsheet API token is configured. Set SMARTSHEET_API_TOKEN, SMARTSHEET_TOKEN, or SMARTSHEET_CONNECTIONS_JSON.",
    );
  }

  const base = sourceApiBaseUrl?.trim() || process.env.SMARTSHEET_API_BASE_URL?.trim();
  return {
    token,
    apiBaseUrl: normalizeSmartsheetApiBaseUrl(base),
  };
}

export interface SmartsheetRequestOptions {
  connectionKey?: string;
  apiBaseUrl?: string;
  /** Override token/base (e.g. Forms config singleton). */
  connection?: ConnectionConfig;
  cache?: RequestCache;
  next?: { revalidate?: number };
  signal?: AbortSignal;
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit | null;
}

/**
 * Low-level Smartsheet API call. Returns parsed JSON (or empty object for empty body).
 * Throws SmartsheetRequestError on non-OK responses / invalid JSON.
 */
export async function smartsheetRequest(
  path: string,
  options: SmartsheetRequestOptions = {},
): Promise<unknown> {
  const connection =
    options.connection ?? resolveConnection(options.connectionKey, options.apiBaseUrl);
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${connection.token}`,
    ...(options.headers ?? {}),
  };
  if (options.body != null && !(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
  }

  const res = await fetch(`${connection.apiBaseUrl}${path}`, {
    method,
    body: options.body,
    headers,
    cache: options.cache ?? "no-store",
    next: options.next,
    signal: options.signal,
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new SmartsheetRequestError(res.status, text || "invalid JSON response");
    }
  }

  if (!res.ok) {
    const message =
      (typeof data.message === "string" && data.message) ||
      text ||
      res.statusText ||
      `Smartsheet request failed with HTTP ${res.status}`;
    throw new SmartsheetRequestError(res.status, message, data.errorCode);
  }

  return data;
}

/** Offset-based pagination until every item is collected. */
export async function listAllPages(
  path: string,
  pageSize = 100,
  options: Omit<SmartsheetRequestOptions, "method" | "body"> = {},
): Promise<unknown[]> {
  const items: unknown[] = [];
  let page = 1;
  while (true) {
    const sep = path.includes("?") ? "&" : "?";
    const data = (await smartsheetRequest(`${path}${sep}pageSize=${pageSize}&page=${page}`, options)) as {
      data?: unknown[];
      totalPages?: number;
    };
    items.push(...(data.data ?? []));
    const totalPages = data.totalPages ?? 1;
    if (page >= totalPages) break;
    page++;
  }
  return items;
}

/** Token-based pagination (workspaces, webhooks, etc.). */
export async function listAllTokenPages(
  path: string,
  maxItems = 100,
  options: Omit<SmartsheetRequestOptions, "method" | "body"> = {},
): Promise<unknown[]> {
  const items: unknown[] = [];
  let lastKey: string | undefined;
  while (true) {
    const sep = path.includes("?") ? "&" : "?";
    const keyPart = lastKey ? `&lastKey=${encodeURIComponent(lastKey)}` : "";
    const data = (await smartsheetRequest(`${path}${sep}maxItems=${maxItems}${keyPart}`, options)) as {
      data?: unknown[];
      lastKey?: string;
    };
    items.push(...(data.data ?? []));
    lastKey = data.lastKey;
    if (!lastKey) break;
  }
  return items;
}
