export type FormFieldKindHint = "text" | "textarea" | "email" | "phone" | "number";

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
  /** Public form heading (like Smartsheet viewer view title). Falls back to sheet name. */
  formTitle?: string;
  /** Public form supporting text (like Smartsheet viewer view description). */
  formDescription?: string;
}

function optionalTrimmed(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

/** Normalize config so `columns` always matches visible ordered fields. */
export function normalizeFormFieldConfig(config: FormFieldConfig): FormFieldConfig {
  const formTitle = optionalTrimmed(config.formTitle);
  const formDescription = optionalTrimmed(config.formDescription);

  if (Array.isArray(config.fields) && config.fields.length > 0) {
    const sorted = [...config.fields].sort((a, b) => a.order - b.order);
    const columns = sorted.filter((f) => !f.hiddenOnForm).map((f) => f.columnTitle);
    return {
      columns,
      fields: sorted.map((f, i) => ({ ...f, order: i })),
      formTitle,
      formDescription,
    };
  }
  return {
    columns: Array.isArray(config.columns) ? config.columns : [],
    fields: config.fields,
    formTitle,
    formDescription,
  };
}
