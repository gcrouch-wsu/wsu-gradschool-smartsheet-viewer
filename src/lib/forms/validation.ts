import { config } from "@/lib/forms/config";
import { isSmartsheetDateColumnType, parseFormDateToIso } from "@/lib/forms/date-format";
import type { FormFieldMeta } from "@/lib/forms/form-field-meta";
import type { ConditionalRule, SmartsheetColumn } from "@/lib/forms/types";

export type SubmissionCell =
  | { columnId: number; value: string | boolean }
  | {
      columnId: number;
      objectValue:
        | { objectType: "CONTACT"; email: string }
        | { objectType: "MULTI_PICKLIST"; values: string[] };
    };

export interface ValidationOutput {
  ok: boolean;
  errors: string[];
  cells: SubmissionCell[];
}

const MAX_LEN = 4000;

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function splitMultiValues(raw: string): string[] {
  return raw
    .split(/\n|;|,/)
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * The authoritative check. The browser does friendly checks for UX, but nothing
 * is trusted until it passes here — this is what makes the rules "hard-enforced".
 */
export function validateSubmission(
  columns: SmartsheetColumn[],
  values: Record<string, string>,
  conditional: ConditionalRule[],
  fieldMeta?: Record<string, FormFieldMeta>,
  allowedDomains?: string[],
): ValidationOutput {
  const errors: string[] = [];
  const cells: SubmissionCell[] = [];
  const domains =
    Array.isArray(allowedDomains) && allowedDomains.length > 0
      ? allowedDomains.map((d) => d.trim().toLowerCase()).filter(Boolean)
      : config.allowedDomains;

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
    const treatAsEmail =
      meta?.kindHint === "email" ||
      (/e-?mail/i.test(col.title) && col.type !== "MULTI_PICKLIST") ||
      col.type === "CONTACT_LIST";

    // Column formulas are computed by Smartsheet — never send a cell write (API error 1302).
    if (col.formula && String(col.formula).trim()) {
      continue;
    }

    // Parent of a per-column checkbox group: validate group, skip writing this column.
    if (meta?.checkboxColumns?.length) {
      const byTitle = new Map(columns.map((c) => [c.title.toLowerCase(), c]));
      const linked = meta.checkboxColumns
        .map((t) => byTitle.get(t.trim().toLowerCase()))
        .filter((c): c is SmartsheetColumn => Boolean(c));
      const anyChecked = linked.some((c) => (values[String(c.id)] ?? "").toString() === "true");
      if (!optional && !anyChecked) {
        errors.push(`${label} is required.`);
      }
      continue;
    }

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

    if (String(col.type).toUpperCase() === "MULTI_PICKLIST") {
      const selected = splitMultiValues(raw);
      if (!selected.length) {
        if (!optional) errors.push(`${label} is required.`);
        continue;
      }
      const options = col.options ?? [];
      if (options.length && selected.some((v) => !options.includes(v))) {
        errors.push(`${label} must be chosen from the listed options.`);
        continue;
      }
      cells.push({
        columnId: col.id,
        objectValue: { objectType: "MULTI_PICKLIST", values: selected },
      });
      continue;
    }

    if (col.type === "CONTACT_LIST") {
      if (!isEmail(raw)) {
        errors.push("Enter a valid email address.");
        continue;
      }
      const domain = raw.split("@")[1]?.toLowerCase() ?? "";
      if (domains.length && !domains.includes(domain)) {
        errors.push(`Email must be from: ${domains.join(", ")}.`);
        continue;
      }
      cells.push({
        columnId: col.id,
        objectValue: { objectType: "CONTACT", email: raw },
      });
      continue;
    }

    if (treatAsEmail) {
      if (!isEmail(raw)) {
        errors.push("Enter a valid email address.");
        continue;
      }
      const domain = raw.split("@")[1]?.toLowerCase() ?? "";
      if (domains.length && !domains.includes(domain)) {
        errors.push(`Email must be from: ${domains.join(", ")}.`);
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

    if (isSmartsheetDateColumnType(col.type)) {
      const iso = parseFormDateToIso(raw);
      if (!iso) {
        errors.push(`${label} must be a valid date.`);
        continue;
      }
      cells.push({ columnId: col.id, value: iso });
      continue;
    }

    cells.push({ columnId: col.id, value: raw });
  }

  return { ok: errors.length === 0, errors, cells };
}
