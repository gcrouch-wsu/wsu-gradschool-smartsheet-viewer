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
    hiddenOnForm: visible ? !visible.has(col.title.toLowerCase()) : false,
  }));
}

/** Ensure every sheet column has a field entry; preserve layout elements and field metadata. */
export function mergeFieldsWithColumns(
  columns: SmartsheetColumn[],
  config: FormFieldConfig | null,
): FormFieldDefinition[] {
  const existing = [...(config?.fields ?? [])].sort((a, b) => a.order - b.order);
  const layoutItems = existing.filter(isLayoutFormItem);
  const existingFields = existing.filter(isFieldFormItem);
  const byTitle = new Map(existingFields.map((f) => [f.columnTitle.toLowerCase(), f]));
  const used = new Set<string>();
  const result: FormFieldDefinition[] = [];
  const hasConfig = Boolean(config?.fields?.length || config?.columns?.length);

  const orderedTitles = config?.columns?.length
    ? config.columns
    : existingFields.map((f) => f.columnTitle);

  // Rebuild in saved order, inserting layout items relative to neighboring fields.
  const layoutByAfterKey = new Map<string, FormFieldDefinition[]>();
  const leadingLayout: FormFieldDefinition[] = [];
  {
    let lastFieldKey: string | null = null;
    for (const item of existing) {
      if (isLayoutFormItem(item)) {
        if (lastFieldKey == null) leadingLayout.push(item);
        else {
          const list = layoutByAfterKey.get(lastFieldKey) ?? [];
          list.push(item);
          layoutByAfterKey.set(lastFieldKey, list);
        }
      } else {
        lastFieldKey = item.columnTitle.toLowerCase();
      }
    }
  }

  for (const item of leadingLayout) {
    result.push({ ...item, order: result.length, itemKind: item.itemKind ?? "heading" });
  }

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
      itemKind: "field",
      hiddenOnForm: prev?.hiddenOnForm ?? false,
      label: prev?.label,
      helpText: prev?.helpText,
      required: prev?.required,
      kindHint: prev?.kindHint,
    });
    for (const layout of layoutByAfterKey.get(key) ?? []) {
      result.push({ ...layout, order: result.length, itemKind: layout.itemKind ?? "heading" });
    }
  }

  for (const col of columns) {
    const key = col.title.toLowerCase();
    if (used.has(key)) continue;
    used.add(key);
    const prev = byTitle.get(key);
    result.push({
      columnTitle: col.title,
      order: result.length,
      itemKind: "field",
      hiddenOnForm: prev?.hiddenOnForm ?? (hasConfig ? true : false),
      label: prev?.label,
      helpText: prev?.helpText,
      required: prev?.required,
      kindHint: prev?.kindHint,
    });
  }

  // Preserve any layout that sat after removed columns (append).
  for (const item of layoutItems) {
    if (result.some((r) => r.columnTitle === item.columnTitle)) continue;
    result.push({ ...item, order: result.length, itemKind: item.itemKind ?? "heading" });
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
