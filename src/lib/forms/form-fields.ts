import type { SmartsheetColumn } from "@/lib/forms/types";
import { loadFormFields } from "@/lib/forms/store/field-config";
import { resolveWorkflow } from "@/lib/forms/workflow";

const SYSTEM_TYPES = new Set([
  "CREATED_DATE",
  "MODIFIED_DATE",
  "CREATED_BY",
  "MODIFIED_BY",
  "AUTO_NUMBER",
]);

/** Automation / routing columns that should not appear on a public submission form. */
export function isInternalFormColumn(title: string): boolean {
  const t = title.trim();
  if (!t) return true;
  if (/^resend\b/i.test(t)) return true;
  if (/^d\d+$/i.test(t)) return true;
  if (/\bapproval\s*date$/i.test(t)) return true;
  if (/^(final pdf|approvals ready|file name)(\b|$)/i.test(t)) return true;
  if (/^form creation/i.test(t)) return true;
  if (/^chr\s+(name|email)\b/i.test(t)) return true;
  if (/^academic coordinator\s+(name|email)\b/i.test(t)) return true;
  if (/^chair\s+(name|email)\b/i.test(t)) return true;
  return false;
}

function titleKey(title: string): string {
  return title.toLowerCase();
}

function isSystemColumn(col: SmartsheetColumn): boolean {
  return Boolean(col.systemColumnType) || SYSTEM_TYPES.has(col.type);
}

export function isSystemFormColumn(col: SmartsheetColumn): boolean {
  return isSystemColumn(col);
}

/** Titles that should never appear on the public form (workflow + internals). */
export async function workflowExcludedTitles(
  sheet: { id?: string | number; columns?: unknown[] },
): Promise<Set<string>> {
  const wf = await resolveWorkflow(sheet);
  return new Set(
    [...wf.approvalStages, wf.overallColumn, ...wf.excludeFromForm]
      .filter(Boolean)
      .map((s) => titleKey(s)),
  );
}

export type FormColumnSource = "smartsheet-config" | "auto";

/**
 * Columns shown on the public form, matching the Smartsheet form layout when possible.
 * Uses stored field config per sheet ID when present; otherwise excludes workflow and
 * internal automation columns from the sheet definition.
 */
export async function resolveFormColumns(
  sheet: { id?: string | number; columns?: unknown[] },
  columns: SmartsheetColumn[],
): Promise<{ columns: SmartsheetColumn[]; source: FormColumnSource }> {
  const sheetId = String(sheet?.id ?? "");
  const configured = sheetId ? await loadFormFields(sheetId) : null;
  if (configured?.fields?.length || configured?.columns?.length) {
    const byTitle = new Map(columns.map((c) => [titleKey(c.title), c]));
    const titles =
      configured.fields?.length
        ? [...configured.fields]
            .filter((f) => !f.hiddenOnForm)
            .sort((a, b) => a.order - b.order)
            .map((f) => f.columnTitle)
        : configured.columns;
    const picked = (titles ?? [])
      .map((title) => byTitle.get(titleKey(title)))
      .filter((c): c is SmartsheetColumn => Boolean(c));
    if (picked.length) return { columns: picked, source: "smartsheet-config" };
  }

  const wf = await resolveWorkflow(sheet);
  const exclude = new Set(
    [...wf.approvalStages, wf.overallColumn, ...wf.excludeFromForm]
      .filter(Boolean)
      .map((s) => titleKey(s)),
  );

  const filtered = columns.filter((col) => {
    if (isSystemColumn(col)) return false;
    const key = titleKey(col.title);
    if (exclude.has(key)) return false;
    if (isInternalFormColumn(col.title)) return false;
    return true;
  });

  return { columns: filtered, source: "auto" };
}

/** @deprecated Use resolveFormColumns — kept for callers that only need a title exclude set. */
export async function formExcludeForSheet(sheet: { id?: string | number; columns?: unknown[] }): Promise<Set<string>> {
  const all: SmartsheetColumn[] = (sheet.columns ?? []).map((c) => {
    const col = c as Record<string, unknown>;
    return {
      id: col.id as number,
      title: String(col.title),
      type: col.type as string,
      options: col.options as string[] | undefined,
      validation: col.validation as boolean | undefined,
      primary: col.primary as boolean | undefined,
      systemColumnType: col.systemColumnType as string | undefined,
    };
  });
  const { columns } = await resolveFormColumns(sheet, all);
  const keep = new Set(columns.map((c) => titleKey(c.title)));
  return new Set(all.filter((c) => !keep.has(titleKey(c.title))).map((c) => titleKey(c.title)));
}
