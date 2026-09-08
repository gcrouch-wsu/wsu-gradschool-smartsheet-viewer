export interface MergeField {
  title: string;
  value: string;
}

export function mergeTemplate(template: string, fields: MergeField[], extras: Record<string, string> = {}): string {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, raw: string) => {
    const key = raw.trim();
    const extra = extras[key] ?? extras[key.toLowerCase()];
    if (extra != null && extra !== "") return extra;
    const field = fields.find((item) => item.title.toLowerCase() === key.toLowerCase());
    return field?.value ?? "";
  });
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
