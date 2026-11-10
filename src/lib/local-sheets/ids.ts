/** UUID v4 (RFC 4122 variant). */
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Sheet / report / row resource id: Smartsheet number or local UUID (or legacy negative). */
export type ResourceId = string | number;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_V4_RE.test(value.trim());
}

export function newLocalUuid(): string {
  return crypto.randomUUID();
}

/** Normalize for DB/storage comparison (trim UUID; keep numeric string exact). */
export function normalizeResourceId(value: ResourceId): string {
  return String(value).trim();
}

export function resourceIdsEqual(a: ResourceId, b: ResourceId): boolean {
  return normalizeResourceId(a) === normalizeResourceId(b);
}

/**
 * Local/offline resources: UUID v4, or legacy negative integer ids from the old counter.
 * Positive Smartsheet ids (and numeric strings of those) are live/imported remote ids.
 */
export function isLocalResourceId(value: ResourceId): boolean {
  if (isUuid(value)) return true;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) && n < 0;
}

/**
 * Parse a form/API id into a ResourceId.
 * Accepts UUID, finite non-zero number, or numeric string.
 */
export function parseResourceId(value: unknown): ResourceId | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value !== 0) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    if (isUuid(trimmed)) return trimmed;
    const n = Number(trimmed);
    if (Number.isFinite(n) && n !== 0) return n;
  }
  return undefined;
}

/** Coerce DB text/bigint driver values without turning UUIDs into NaN. */
export function coerceResourceId(value: unknown): ResourceId {
  if (isUuid(value)) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    if (isUuid(trimmed)) return trimmed;
    const n = Number(trimmed);
    if (Number.isFinite(n) && /^-?\d+(\.0+)?$/.test(trimmed)) return n;
    return trimmed;
  }
  throw new Error(`Invalid resource id: ${String(value)}`);
}
