import { isSmartsheetDateColumnType, parseFormDateToIso } from "@/lib/forms/date-format";
import type { FormFieldDefinition } from "@/lib/forms/form-field-config";
import { isLayoutFormItem } from "@/lib/forms/form-field-config";
import type { FormFieldMeta } from "@/lib/forms/form-field-meta";
import type { ConditionalRule, SmartsheetColumn } from "@/lib/forms/types";

export type FormFieldKind =
  | "checkbox"
  | "select"
  | "radio"
  | "multiselect"
  | "date"
  | "email"
  | "textarea"
  | "text"
  | "phone"
  | "number";

export interface FormSchema {
  sheetName: string;
  /** Public form heading; falls back to sheetName when unset. */
  formTitle?: string;
  /** Supporting copy under the form title (viewer-style description). */
  formDescription?: string;
  columns: SmartsheetColumn[];
  /** Ordered visible canvas items (data fields + layout elements). */
  formItems?: FormFieldDefinition[];
  formColumnSource?: "smartsheet-config" | "auto";
  fieldMeta?: Record<string, FormFieldMeta>;
  conditionalLogic: ConditionalRule[];
  allowedDomains: string[];
  demo: boolean;
  attachmentsEnabled?: boolean;
  /** Optional custom header logo (PNG/JPEG data URL). */
  headerLogoDataUrl?: string;
  headerLogoAlt?: string;
}

const MAX_LEN = 4000;

export function fieldKind(col: SmartsheetColumn, meta?: FormFieldMeta): FormFieldKind {
  const type = String(col.type || "").toUpperCase();
  if (type === "CHECKBOX") return "checkbox";
  if (type === "MULTI_PICKLIST" || meta?.kindHint === "multiselect" || (meta?.checkboxColumns?.length ?? 0) > 0) {
    return "multiselect";
  }
  // Smartsheet "Dropdown (single-select)" — Forms often Display As radio buttons; we default to radio.
  if (type === "PICKLIST" || (col.options && col.options.length)) {
    if (meta?.kindHint === "select" || meta?.kindHint === "dropdown") return "select";
    if (meta?.kindHint === "radio") return "radio";
    return "radio";
  }
  if (isSmartsheetDateColumnType(col.type)) return "date";
  if (type === "PHONE" || meta?.kindHint === "phone") return "phone";
  if (meta?.kindHint === "number") return "number";
  if (meta?.kindHint === "textarea") return "textarea";
  if (meta?.kindHint === "email") return "email";
  if (meta?.kindHint === "text") return "text";
  if (/e-?mail/i.test(col.title) || type === "CONTACT_LIST") return "email";
  if (/phone|mobile|cell/i.test(col.title)) return "phone";
  if (/message|comment|description|notes?|details?/i.test(col.title)) return "textarea";
  return "text";
}

export function fieldLabel(col: SmartsheetColumn, meta?: FormFieldMeta): string {
  return meta?.label?.trim() || col.title;
}

export function conditionalTargetTitles(rules: ConditionalRule[]): Set<string> {
  const targets = new Set<string>();
  for (const rule of rules) {
    for (const t of rule.showColumns) targets.add(t.toLowerCase());
  }
  return targets;
}

export function hiddenColumnTitles(
  columns: SmartsheetColumn[],
  rules: ConditionalRule[],
  values: Record<string, string>,
): Set<string> {
  const hidden = new Set<string>();
  for (const rule of rules) {
    const source = columns.find((c) => c.title.toLowerCase() === rule.whenColumn.toLowerCase());
    const current = source ? (values[String(source.id)] ?? "") : "";
    const show = rule.equals.some((v) => v.toLowerCase() === current.toLowerCase());
    if (!show) {
      for (const t of rule.showColumns) hidden.add(t.toLowerCase());
    }
  }
  return hidden;
}

export function isFieldVisible(col: SmartsheetColumn, hidden: Set<string>): boolean {
  return !hidden.has(col.title.toLowerCase());
}

export function isFieldRequired(
  col: SmartsheetColumn,
  conditionalTargets: Set<string>,
  hidden: Set<string>,
  meta?: FormFieldMeta,
): boolean {
  if (col.type === "CHECKBOX") return false;
  if (hidden.has(col.title.toLowerCase())) return false;
  if (typeof meta?.required === "boolean") return meta.required;
  return !conditionalTargets.has(col.title.toLowerCase());
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function splitMultiValues(raw: string): string[] {
  return raw
    .split(/\n|;|,/)
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Client-side validation aligned with server validateSubmission rules. */
export function validateFormClient(
  columns: SmartsheetColumn[],
  values: Record<string, string>,
  conditional: ConditionalRule[],
  allowedDomains: string[],
  fieldMeta?: Record<string, FormFieldMeta>,
): { ok: boolean; errors: string[]; fieldErrors: Record<string, string> } {
  const errors: string[] = [];
  const fieldErrors: Record<string, string> = {};
  const hidden = hiddenColumnTitles(columns, conditional, values);
  const conditionalTargets = conditionalTargetTitles(conditional);

  for (const col of columns) {
    if (!isFieldVisible(col, hidden)) continue;

    const key = String(col.id);
    const meta = fieldMeta?.[col.title.toLowerCase()];
    const label = fieldLabel(col, meta);
    const raw = (values[key] ?? "").toString().trim();
    const required = isFieldRequired(col, conditionalTargets, hidden, meta);
    const kind = fieldKind(col, meta);

    if (meta?.checkboxColumns?.length) {
      const byTitle = new Map(columns.map((c) => [c.title.toLowerCase(), c]));
      const linked = meta.checkboxColumns
        .map((t) => byTitle.get(t.trim().toLowerCase()))
        .filter((c): c is SmartsheetColumn => Boolean(c));
      const anyChecked = linked.some((c) => (values[String(c.id)] ?? "") === "true");
      if (required && !anyChecked) {
        const msg = `${label} is required.`;
        errors.push(msg);
        fieldErrors[key] = msg;
      }
      continue;
    }

    if (col.type === "CHECKBOX") continue;

    if (!raw) {
      if (required) {
        const msg = `${label} is required.`;
        errors.push(msg);
        fieldErrors[key] = msg;
      }
      continue;
    }

    if (raw.length > MAX_LEN) {
      const msg = `${label} is too long.`;
      errors.push(msg);
      fieldErrors[key] = msg;
      continue;
    }

    if (kind === "multiselect") {
      const selected = splitMultiValues(raw);
      const options = col.options ?? [];
      if (options.length && selected.some((v) => !options.includes(v))) {
        const msg = `${label} must be chosen from the listed options.`;
        errors.push(msg);
        fieldErrors[key] = msg;
      }
      continue;
    }

    if (kind === "email" || col.type === "CONTACT_LIST" || /e-?mail/i.test(col.title)) {
      if (!isEmail(raw)) {
        const msg = "Enter a valid email address.";
        errors.push(msg);
        fieldErrors[key] = msg;
        continue;
      }
      const domain = raw.split("@")[1]?.toLowerCase() ?? "";
      if (allowedDomains.length && !allowedDomains.includes(domain)) {
        const msg = `Email must be from: ${allowedDomains.join(", ")}.`;
        errors.push(msg);
        fieldErrors[key] = msg;
        continue;
      }
    }

    if (kind === "select" && col.options && col.options.length && !col.options.includes(raw)) {
      const msg = `${label} must be one of: ${col.options.join(", ")}.`;
      errors.push(msg);
      fieldErrors[key] = msg;
    }

    if (kind === "number" && Number.isNaN(Number(raw))) {
      const msg = `${label} must be a number.`;
      errors.push(msg);
      fieldErrors[key] = msg;
    }

    if (kind === "date" || isSmartsheetDateColumnType(col.type)) {
      if (!parseFormDateToIso(raw)) {
        const msg = `${label} must be a valid date.`;
        errors.push(msg);
        fieldErrors[key] = msg;
      }
    }
  }

  return { ok: errors.length === 0, errors, fieldErrors };
}

export function buildSubmitPayload(
  columns: SmartsheetColumn[],
  values: Record<string, string>,
  conditional: ConditionalRule[],
  fieldMeta?: Record<string, FormFieldMeta>,
): Record<string, string> {
  const hidden = hiddenColumnTitles(columns, conditional, values);
  const payload: Record<string, string> = {};
  for (const col of columns) {
    const isLinkedCheckbox =
      col.type === "CHECKBOX" &&
      Object.values(fieldMeta ?? {}).some((m) =>
        m.checkboxColumns?.some((t) => t.trim().toLowerCase() === col.title.toLowerCase()),
      );
    if (!isFieldVisible(col, hidden) && !isLinkedCheckbox) continue;
    const raw = values[String(col.id)] ?? (col.type === "CHECKBOX" ? "false" : "");
    if (isSmartsheetDateColumnType(col.type)) {
      const iso = parseFormDateToIso(raw);
      payload[col.id] = iso ?? raw;
      continue;
    }
    payload[col.id] = raw;
  }
  return payload;
}

/** Resolve ordered render list: layout items interleaved with visible columns. */
export function resolveFormRenderItems(
  schema: FormSchema,
  hidden: Set<string>,
): Array<
  | { kind: "layout"; item: FormFieldDefinition }
  | { kind: "field"; col: SmartsheetColumn; item?: FormFieldDefinition }
> {
  const byTitle = new Map(schema.columns.map((c) => [c.title.toLowerCase(), c]));
  const items = schema.formItems;

  if (items?.length) {
    const out: Array<
      | { kind: "layout"; item: FormFieldDefinition }
      | { kind: "field"; col: SmartsheetColumn; item?: FormFieldDefinition }
    > = [];
    for (const item of items) {
      if (item.hiddenOnForm) continue;
      if (isLayoutFormItem(item)) {
        out.push({ kind: "layout", item });
        continue;
      }
      const col = byTitle.get(item.columnTitle.toLowerCase());
      if (!col || !isFieldVisible(col, hidden)) continue;
      out.push({ kind: "field", col, item });
    }
    return out;
  }

  return schema.columns
    .filter((col) => isFieldVisible(col, hidden))
    .map((col) => ({ kind: "field" as const, col }));
}
