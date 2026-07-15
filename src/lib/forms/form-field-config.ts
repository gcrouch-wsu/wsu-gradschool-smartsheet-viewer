export type FormFieldKindHint = "text" | "textarea" | "email" | "phone" | "number";

/** Display-only form elements (not Smartsheet columns). */
export type FormLayoutElementType = "heading" | "description" | "divider";

/** Canvas item kind: data field or layout/content element. */
export type FormItemKind = "field" | FormLayoutElementType;

/** Per-field / layout presentation metadata for the public form builder. */
export interface FormFieldDefinition {
  /**
   * For fields: Smartsheet column title.
   * For layout elements: stable synthetic id (e.g. `__heading:abc`).
   */
  columnTitle: string;
  order: number;
  hiddenOnForm?: boolean;
  /** Defaults to `"field"` when omitted. */
  itemKind?: FormItemKind;
  /** Heading / description body text. */
  text?: string;
  label?: string;
  helpText?: string;
  required?: boolean;
  kindHint?: FormFieldKindHint;
}

export interface FormFieldConfig {
  /** Ordered column titles visible on the public form (derived from field items only). */
  columns: string[];
  /** Richer per-field layout and presentation; preferred when present. */
  fields?: FormFieldDefinition[];
  /** Public form heading (like Smartsheet viewer view title). Falls back to sheet name. */
  formTitle?: string;
  /** Public form supporting text (like Smartsheet viewer view description). */
  formDescription?: string;
  /**
   * Allowed email domains for this form (e.g. ["wsu.edu"]).
   * Empty/unset falls back to env ALLOWED_DOMAINS, then wsu.edu.
   */
  allowedDomains?: string[];
  /**
   * Whether this form accepts file uploads.
   * Unset falls back to env ATTACHMENTS_ENABLED (default true).
   */
  attachmentsEnabled?: boolean;
}

function optionalTrimmed(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function isLayoutFormItem(field: Pick<FormFieldDefinition, "itemKind">): boolean {
  return field.itemKind === "heading" || field.itemKind === "description" || field.itemKind === "divider";
}

export function isFieldFormItem(field: Pick<FormFieldDefinition, "itemKind">): boolean {
  return !isLayoutFormItem(field);
}

export function newLayoutElementId(type: FormLayoutElementType): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `__${type}:${suffix}`;
}

export function defaultTextForLayout(type: FormLayoutElementType): string {
  if (type === "heading") return "Section heading";
  if (type === "description") return "Add supporting instructions for this section.";
  return "";
}

/** Normalize config so `columns` always matches visible ordered data fields. */
export function normalizeFormFieldConfig(config: FormFieldConfig): FormFieldConfig {
  const formTitle = optionalTrimmed(config.formTitle);
  const formDescription = optionalTrimmed(config.formDescription);
  const allowedDomains = Array.isArray(config.allowedDomains)
    ? config.allowedDomains
        .map((d) => String(d).trim().toLowerCase())
        .filter(Boolean)
    : undefined;
  const attachmentsEnabled =
    typeof config.attachmentsEnabled === "boolean" ? config.attachmentsEnabled : undefined;

  if (Array.isArray(config.fields) && config.fields.length > 0) {
    const sorted = [...config.fields].sort((a, b) => a.order - b.order);
    const columns = sorted
      .filter((f) => isFieldFormItem(f) && !f.hiddenOnForm)
      .map((f) => f.columnTitle);
    return {
      columns,
      fields: sorted.map((f, i) => ({ ...f, order: i, itemKind: f.itemKind ?? "field" })),
      formTitle,
      formDescription,
      ...(allowedDomains?.length ? { allowedDomains } : {}),
      ...(typeof attachmentsEnabled === "boolean" ? { attachmentsEnabled } : {}),
    };
  }
  return {
    columns: Array.isArray(config.columns) ? config.columns : [],
    fields: config.fields,
    formTitle,
    formDescription,
    ...(allowedDomains?.length ? { allowedDomains } : {}),
    ...(typeof attachmentsEnabled === "boolean" ? { attachmentsEnabled } : {}),
  };
}
