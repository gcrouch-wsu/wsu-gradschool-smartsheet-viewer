export interface MergeField {
  title: string;
  value: string;
}

export function mergeTemplate(template: string, fields: MergeField[], extras: Record<string, string> = {}): string {
  const extraLookup = new Map<string, string>();
  for (const [key, value] of Object.entries(extras)) {
    extraLookup.set(key.trim().toLowerCase(), value);
  }
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, raw: string) => {
    const key = raw.trim().toLowerCase();
    const extra = extraLookup.get(key);
    if (extra != null && extra !== "") return extra;
    const field = fields.find((item) => item.title.toLowerCase() === key);
    return field?.value ?? "";
  });
}

/** Value of the sheet's primary column, then a name-like column, for {{Primary}}. */
export function primaryFieldValue(fields: MergeField[], primaryTitle: string | null): string {
  const titled = (title: string | null | undefined) => {
    if (!title) return "";
    const match = fields.find((field) => field.title.toLowerCase() === title.toLowerCase());
    return match?.value.trim() ?? "";
  };
  const primary = titled(primaryTitle);
  if (primary) return primary;
  const named = fields.find((field) => /name/i.test(field.title) && field.value.trim());
  return named?.value.trim() ?? "";
}

export function includedFields(
  fields: MergeField[],
  includeColumnIds: number[],
  idByTitle: Map<string, number>,
): MergeField[] {
  if (!includeColumnIds.length) return fields.slice(0, 8);
  const allowed = new Set(includeColumnIds);
  return fields.filter((field) => {
    const id = idByTitle.get(field.title);
    return id != null && allowed.has(id);
  });
}
