import { config } from "@/lib/forms/config";
import type { FormFieldMeta } from "@/lib/forms/form-field-meta";
import type { ConditionalRule, SmartsheetColumn } from "@/lib/forms/types";

export interface ValidationOutput {
  ok: boolean;
  errors: string[];
  cells: { columnId: number; value: string | boolean }[];
}

const MAX_LEN = 4000;

/**
 * The authoritative check. The browser does friendly checks for UX, but nothing
 * is trusted until it passes here — this is what makes the rules "hard-enforced".
 */
export function validateSubmission(
  columns: SmartsheetColumn[],
  values: Record<string, string>,
  conditional: ConditionalRule[],
  fieldMeta?: Record<string, FormFieldMeta>,
): ValidationOutput {
  const errors: string[] = [];
  const cells: { columnId: number; value: string | boolean }[] = [];

  const conditionalTargets = new Set<string>();
  for (const rule of conditional) {
    for (const t of rule.showColumns) conditionalTargets.add(t.toLowerCase());
  }

  for (const col of columns) {
    const raw = (values[String(col.id)] ?? "").toString().trim();
    const meta = fieldMeta?.[col.title.toLowerCase()];
    const label = meta?.label?.trim() || col.title;
    const optional =
      typeof meta?.required === "boolean" ? !meta.required : conditionalTargets.has(col.title.toLowerCase());
    const treatAsEmail = meta?.kindHint === "email" || /e-?mail/i.test(col.title) || col.type === "CONTACT_LIST";

    if (col.type === "CHECKBOX") {
      cells.push({ columnId: col.id, value: raw === "true" });
      continue;
    }

    if (!raw) {
      if (!optional) errors.push(`${label} is required.`);
      continue;
    }

    if (raw.length > MAX_LEN) {
      errors.push(`${label} is too long.`);
      continue;
    }

    if (treatAsEmail) {
      if (!isEmail(raw)) {
        errors.push("Enter a valid email address.");
        continue;
      }
      const domain = raw.split("@")[1]?.toLowerCase() ?? "";
      if (!config.allowedDomains.includes(domain)) {
        errors.push(`Email must be from: ${config.allowedDomains.join(", ")}.`);
        continue;
      }
    }

    if (col.options && col.options.length && !col.options.includes(raw)) {
      errors.push(`${label} must be one of: ${col.options.join(", ")}.`);
      continue;
    }

    if (meta?.kindHint === "number" && Number.isNaN(Number(raw))) {
      errors.push(`${label} must be a number.`);
      continue;
    }

    cells.push({ columnId: col.id, value: raw });
  }

  return { ok: errors.length === 0, errors, cells };
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
