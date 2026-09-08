const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export function normalizeEmail(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) return null;
  return trimmed;
}

export function extractEmails(value: unknown): string[] {
  const found = new Set<string>();

  function walk(entry: unknown) {
    if (entry == null) return;
    if (typeof entry === "string") {
      const matches = entry.match(EMAIL_PATTERN) ?? [];
      for (const match of matches) {
        const email = normalizeEmail(match);
        if (email) found.add(email);
      }
      return;
    }
    if (Array.isArray(entry)) {
      for (const item of entry) walk(item);
      return;
    }
    if (typeof entry === "object") {
      const obj = entry as Record<string, unknown>;
      if (typeof obj.email === "string") walk(obj.email);
      if (Array.isArray(obj.values)) walk(obj.values);
      if (obj.objectValue) walk(obj.objectValue);
    }
  }

  walk(value);
  return [...found];
}

export function emailsFromContactCell(cell: {
  value?: unknown;
  displayValue?: unknown;
  objectValue?: unknown;
} | null | undefined): string[] {
  if (!cell) return [];
  return extractEmails([cell.objectValue, cell.displayValue, cell.value]);
}
