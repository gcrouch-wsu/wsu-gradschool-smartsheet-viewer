import type { FormFieldConfig, FormFieldDefinition } from "@/lib/forms/form-field-config";
import { normalizeFormFieldConfig } from "@/lib/forms/form-field-config";
import type { SmartsheetColumn } from "@/lib/forms/types";

export type { FormFieldConfig, FormFieldDefinition, FormFieldKindHint } from "@/lib/forms/form-field-config";
export { normalizeFormFieldConfig } from "@/lib/forms/form-field-config";

export interface FormFieldMeta {
  columnTitle: string;
  label?: string;
  helpText?: string;
  required?: boolean;
  kindHint?: FormFieldDefinition["kindHint"];
}

/** Build fieldMeta map keyed by column title (lowercase) for the public schema. */
export function fieldMetaFromConfig(config: FormFieldConfig | null | undefined): Record<string, FormFieldMeta> {
  const normalized = config ? normalizeFormFieldConfig(config) : null;
  const meta: Record<string, FormFieldMeta> = {};
  if (!normalized?.fields?.length) return meta;
  for (const field of normalized.fields) {
    if (field.hiddenOnForm) continue;
    meta[field.columnTitle.toLowerCase()] = {
      columnTitle: field.columnTitle,
      label: field.label,
      helpText: field.helpText,
      required: field.required,
      kindHint: field.kindHint,
    };
  }
  return meta;
}

export function fieldMetaForColumn(
  meta: Record<string, FormFieldMeta> | undefined,
  col: SmartsheetColumn,
): FormFieldMeta | undefined {
  if (!meta) return undefined;
  return meta[col.title.toLowerCase()];
}

/** Seed field definitions from sheet columns when no config exists yet. */
export function seedFieldsFromColumns(columns: SmartsheetColumn[], visibleTitles?: string[]): FormFieldDefinition[] {
  const visible = visibleTitles?.length
    ? new Set(visibleTitles.map((t) => t.toLowerCase()))
    : null;

  return columns.map((col, index) => ({
    columnTitle: col.title,
    order: index,
    hiddenOnForm: visible ? !visible.has(col.title.toLowerCase()) : false,
  }));
}

/** Ensure every sheet column has a field entry; preserve existing metadata. */
export function mergeFieldsWithColumns(
  columns: SmartsheetColumn[],
  config: FormFieldConfig | null,
): FormFieldDefinition[] {
  const existing = config?.fields ?? [];
  const byTitle = new Map(existing.map((f) => [f.columnTitle.toLowerCase(), f]));
  const used = new Set<string>();
  const result: FormFieldDefinition[] = [];
  const hasConfig = Boolean(config?.fields?.length || config?.columns?.length);

  const orderedTitles =
    config?.columns?.length ? config.columns : existing.sort((a, b) => a.order - b.order).map((f) => f.columnTitle);

  for (const title of orderedTitles) {
    const col = columns.find((c) => c.title.toLowerCase() === title.toLowerCase());
    if (!col) continue;
    const key = col.title.toLowerCase();
    if (used.has(key)) continue;
    used.add(key);
    const prev = byTitle.get(key);
    result.push({
      columnTitle: col.title,
      order: result.length,
      hiddenOnForm: prev?.hiddenOnForm ?? false,
      label: prev?.label,
      helpText: prev?.helpText,
      required: prev?.required,
      kindHint: prev?.kindHint,
    });
  }

  for (const col of columns) {
    const key = col.title.toLowerCase();
    if (used.has(key)) continue;
    used.add(key);
    const prev = byTitle.get(key);
    result.push({
      columnTitle: col.title,
      order: result.length,
      // Without saved config, show all columns; with config, new columns default off the form.
      hiddenOnForm: prev?.hiddenOnForm ?? (hasConfig ? true : false),
      label: prev?.label,
      helpText: prev?.helpText,
      required: prev?.required,
      kindHint: prev?.kindHint,
    });
  }

  return result;
}

export function deriveFormFieldConfig(
  fields: FormFieldDefinition[],
  presentation?: { formTitle?: string; formDescription?: string },
): FormFieldConfig {
  return normalizeFormFieldConfig({
    columns: [],
    fields,
    formTitle: presentation?.formTitle,
    formDescription: presentation?.formDescription,
  });
}
