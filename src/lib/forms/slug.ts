/** Normalize a display name or raw slug into a url-safe form slug. */
export function normalizeFormSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function slugFromFormName(name: string, fallbackId: string): string {
  const fromName = normalizeFormSlug(name);
  if (fromName) return fromName;
  return normalizeFormSlug(`form-${fallbackId}`) || `form-${fallbackId}`.slice(0, 64);
}
