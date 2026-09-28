/** Shared column-title key normalization (safe for client and server bundles). */
export function normalizeColumnKey(value: string) {
  return value.trim().toLowerCase();
}
