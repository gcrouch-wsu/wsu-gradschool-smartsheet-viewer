export type FormFieldKindHint = "text" | "textarea" | "email";

/** Per-field presentation metadata for the public form builder. */
export interface FormFieldDefinition {
  columnTitle: string;
  order: number;
  hiddenOnForm?: boolean;
  label?: string;
  helpText?: string;
  required?: boolean;
  kindHint?: FormFieldKindHint;
}

export interface FormFieldConfig {
  /** Ordered column titles visible on the public form (derived from `fields` when present). */
  columns: string[];
  /** Richer per-field layout and presentation; preferred when present. */
  fields?: FormFieldDefinition[];
}

/** Normalize config so `columns` always matches visible ordered fields. */
export function normalizeFormFieldConfig(config: FormFieldConfig): FormFieldConfig {
  if (Array.isArray(config.fields) && config.fields.length > 0) {
    const sorted = [...config.fields].sort((a, b) => a.order - b.order);
    const columns = sorted.filter((f) => !f.hiddenOnForm).map((f) => f.columnTitle);
    return { columns, fields: sorted.map((f, i) => ({ ...f, order: i })) };
  }
  return {
    columns: Array.isArray(config.columns) ? config.columns : [],
    fields: config.fields,
  };
}
