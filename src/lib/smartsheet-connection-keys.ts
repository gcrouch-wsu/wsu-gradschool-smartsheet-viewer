/**
 * Lists configured Smartsheet connection keys from env only (no API calls).
 * Rules mirror `parseConnectionsEnv` in `smartsheet.ts`: string values need a non-empty token;
 * object values need a non-empty `token` and a valid optional `apiBaseUrl`.
 */
import { normalizeSmartsheetApiBaseUrl } from "@/lib/smartsheet-api-url";

export function listConfiguredSmartsheetConnectionKeys(): string[] {
  const raw = process.env.SMARTSHEET_CONNECTIONS_JSON?.trim();
  const keys: string[] = [];

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, string | { token: string; apiBaseUrl?: string }>;
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string") {
          if (value.trim()) {
            keys.push(key);
          }
          continue;
        }
        if (value && typeof value === "object" && typeof value.token === "string" && value.token.trim()) {
          try {
            normalizeSmartsheetApiBaseUrl(value.apiBaseUrl);
          } catch {
            continue;
          }
          keys.push(key);
        }
      }
    } catch {
      /* invalid JSON — same as skipping until Smartsheet is used */
    }
  }

  if (
    (process.env.SMARTSHEET_API_TOKEN?.trim() || process.env.SMARTSHEET_TOKEN?.trim()) &&
    !keys.includes("default")
  ) {
    keys.unshift("default");
  }
  return keys.length > 0 ? keys : ["default"];
}
