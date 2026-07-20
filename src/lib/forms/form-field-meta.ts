import type { FormFieldConfig, FormFieldDefinition } from "@/lib/forms/form-field-config";
import {
  isFieldFormItem,
  isLayoutFormItem,
  normalizeFormFieldConfig,
} from "@/lib/forms/form-field-config";
import type { SmartsheetColumn } from "@/lib/forms/types";

export type {
  FormFieldConfig,
  FormFieldDefinition,
  FormFieldKindHint,
  FormItemKind,
  FormLayoutElementType,
} from "@/lib/forms/form-field-config";
export {
  defaultTextForLayout,
  isFieldFormItem,
  isLayoutFormItem,
  newLayoutElementId,
  normalizeFormFieldConfig,
} from "@/lib/forms/form-field-config";

export interface FormFieldMeta {
  columnTitle: string;
  label?: string;
  helpText?: string;
  required?: boolean;
  kindHint?: FormFieldDefinition["kindHint"];
  checkboxColumns?: string[];
  checkboxLabels?: string[];
}

/** Build fieldMeta map keyed by column title (lowercase) for the public schema. */
export function fieldMetaFromConfig(config: FormFieldConfig | null | undefined): Record<string, FormFieldMeta> {
  const normalized = config ? normalizeFormFieldConfig(config) : null;
  const meta: Record<string, FormFieldMeta> = {};
  if (!normalized?.fields?.length) return meta;
  for (const field of normalized.fields) {
    if (field.hiddenOnForm || isLayoutFormItem(field)) continue;
    meta[field.columnTitle.toLowerCase()] = {
      columnTitle: field.columnTitle,
      label: field.label,
      helpText: field.helpText,
      required: field.required,
      kindHint: field.kindHint,
      checkboxColumns: field.checkboxColumns,
      checkboxLabels: field.checkboxLabels,
    };
  }
  return meta;
}

/** Titles of CHECKBOX columns owned by a checkbox-group field (should not render alone). */
export function linkedCheckboxColumnTitles(config: FormFieldConfig | null | undefined): Set<string> {
  const titles = new Set<string>();
  for (const field of config?.fields ?? []) {
    for (const t of field.checkboxColumns ?? []) {
      if (t.trim()) titles.add(t.trim().toLowerCase());
    }
  }
  return titles;
}

/** Append linked CHECKBOX columns so submit can write them. */
export function expandColumnsWithCheckboxGroups(
  columns: SmartsheetColumn[],
  allColumns: SmartsheetColumn[],
  config: FormFieldConfig | null | undefined,
): SmartsheetColumn[] {
  const byTitle = new Map(allColumns.map((c) => [c.title.toLowerCase(), c]));
  const have = new Set(columns.map((c) => c.title.toLowerCase()));
  const out = [...columns];
  for (const field of config?.fields ?? []) {
    if (field.hiddenOnForm) continue;
    for (const title of field.checkboxColumns ?? []) {
      const key = title.trim().toLowerCase();
      if (!key || have.has(key)) continue;
      const col = byTitle.get(key);
      if (!col) continue;
      out.push(col);
      have.add(key);
    }
  }
  return out;
}

/** CHKBOX_* columns available for mapping, in sheet order. */
export function listMappableCheckboxColumns(columns: SmartsheetColumn[]): SmartsheetColumn[] {
  return columns.filter(
    (c) => String(c.type).toUpperCase() === "CHECKBOX" && /^chkbox([_-]?\d+)?$/i.test(c.title.trim()),
  );
}

export function fieldMetaForColumn(
  meta: Record<string, FormFieldMeta> | undefined,
  col: SmartsheetColumn,
): FormFieldMeta | undefined {
  if (!meta) return undefined;
  return meta[col.title.toLowerCase()];
}

/** Visible ordered canvas items for the public form (fields + layout). */
export function visibleFormItems(config: FormFieldConfig | null | undefined): FormFieldDefinition[] {
  const normalized = config ? normalizeFormFieldConfig(config) : null;
  if (!normalized?.fields?.length) return [];
  return normalized.fields.filter((f) => !f.hiddenOnForm);
}

/** Seed field definitions from sheet columns when no config exists yet. */
export function seedFieldsFromColumns(columns: SmartsheetColumn[], visibleTitles?: string[]): FormFieldDefinition[] {
  const visible = visibleTitles?.length
    ? new Set(visibleTitles.map((t) => t.toLowerCase()))
    : null;

  return columns.map((col, index) => ({
    columnTitle: col.title,
    order: index,
    itemKind: "field" as const,
    hiddenOnForm: visible
      ? !visible.has(col.title.toLowerCase())
      : /^chkbox([_-]?\d+)?$/i.test(col.title.trim()),
  }));
}

/** Ensure every sheet column has a field entry; preserve layout elements and field metadata. */
export function mergeFieldsWithColumns(
  columns: SmartsheetColumn[],
  config: FormFieldConfig | null,
): FormFieldDefinition[] {
  const existing = [...(config?.fields ?? [])].sort((a, b) => a.order - b.order);
  const hasConfig = Boolean(config?.fields?.length || config?.columns?.length);

  if (!existing.length) {
    return seedFieldsFromColumns(columns, config?.columns);
  }

  const sheetByTitle = new Map(columns.map((c) => [c.title.toLowerCase(), c]));
  const used = new Set<string>();
  const result: FormFieldDefinition[] = [];

  // Walk saved canvas order exactly (fields + layout), so reorder survives reload.
  for (const item of existing) {
    if (isLayoutFormItem(item)) {
      result.push({
        ...item,
        order: result.length,
        itemKind: item.itemKind ?? "heading",
      });
      continue;
    }

    const col = sheetByTitle.get(item.columnTitle.toLowerCase());
    if (!col) continue;
    const key = col.title.toLowerCase();
    if (used.has(key)) continue;
    used.add(key);

    const defaultHidden = /^chkbox([_-]?\d+)?$/i.test(col.title.trim());
    result.push({
      columnTitle: col.title,
      order: result.length,
      itemKind: "field",
      hiddenOnForm: item.hiddenOnForm ?? defaultHidden,
      label: item.label,
      helpText: item.helpText,
      required: item.required,
      kindHint: item.kindHint,
      checkboxColumns: item.checkboxColumns,
      checkboxLabels: item.checkboxLabels,
    });
  }

  // New sheet columns not yet in config (append; keep existing order intact).
  for (const col of columns) {
    const key = col.title.toLowerCase();
    if (used.has(key)) continue;
    used.add(key);
    const defaultHidden = /^chkbox([_-]?\d+)?$/i.test(col.title.trim()) || hasConfig;
    result.push({
      columnTitle: col.title,
      order: result.length,
      itemKind: "field",
      hiddenOnForm: defaultHidden,
    });
  }

  return result;
}

export function deriveFormFieldConfig(
  fields: FormFieldDefinition[],
  presentation?: {
    formTitle?: string;
    formDescription?: string;
    allowedDomains?: string[];
    attachmentsEnabled?: boolean;
  },
): FormFieldConfig {
  return normalizeFormFieldConfig({
    columns: [],
    fields,
    formTitle: presentation?.formTitle,
    formDescription: presentation?.formDescription,
    allowedDomains: presentation?.allowedDomains,
    attachmentsEnabled: presentation?.attachmentsEnabled,
  });
}
