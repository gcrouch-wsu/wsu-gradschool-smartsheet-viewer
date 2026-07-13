import type { FormFieldMeta } from "@/lib/forms/form-field-meta";
import type { ConditionalRule, SmartsheetColumn } from "@/lib/forms/types";

export type FormFieldKind = "checkbox" | "select" | "date" | "email" | "textarea" | "text";

export interface FormSchema {
  sheetName: string;
  columns: SmartsheetColumn[];
  formColumnSource?: "smartsheet-config" | "auto";
  fieldMeta?: Record<string, FormFieldMeta>;
  conditionalLogic: ConditionalRule[];
  allowedDomains: string[];
  demo: boolean;
  attachmentsEnabled?: boolean;
}

const MAX_LEN = 4000;

export function fieldKind(col: SmartsheetColumn, meta?: FormFieldMeta): FormFieldKind {
  if (col.type === "CHECKBOX") return "checkbox";
  if (col.options && col.options.length) return "select";
  if (col.type === "DATE" || col.type === "ABSTRACT_DATETIME") return "date";
  if (meta?.kindHint === "textarea") return "textarea";
  if (meta?.kindHint === "email") return "email";
  if (meta?.kindHint === "text") return "text";
  if (/e-?mail/i.test(col.title) || col.type === "CONTACT_LIST") return "email";
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

    if (kind === "email" || /e-?mail/i.test(col.title)) {
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

    if (col.options && col.options.length && !col.options.includes(raw)) {
      const msg = `${label} must be one of: ${col.options.join(", ")}.`;
      errors.push(msg);
      fieldErrors[key] = msg;
    }
  }

  return { ok: errors.length === 0, errors, fieldErrors };
}

export function buildSubmitPayload(
  columns: SmartsheetColumn[],
  values: Record<string, string>,
  conditional: ConditionalRule[],
): Record<string, string> {
  const hidden = hiddenColumnTitles(columns, conditional, values);
  const payload: Record<string, string> = {};
  for (const col of columns) {
    if (!isFieldVisible(col, hidden)) continue;
    payload[col.id] = values[String(col.id)] ?? (col.type === "CHECKBOX" ? "false" : "");
  }
  return payload;
}
