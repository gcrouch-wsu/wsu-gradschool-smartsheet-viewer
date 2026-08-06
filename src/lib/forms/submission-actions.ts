import { loadWorkflow } from "@/lib/forms/store/workflow-config";
import { stageColumns } from "@/lib/forms/tracker";
import { resolveWorkflow } from "@/lib/forms/workflow";

export async function findCurrentStage(
  sheet: { id?: string | number; columns?: unknown[]; rows?: unknown[] },
  rowId: number,
): Promise<{ name: string; columnId: number } | null> {
  const wf = await resolveWorkflow(sheet);
  const stages = await stageColumns(sheet);
  const row = (sheet.rows ?? []).find((r) => (r as { id: number }).id === rowId) as
    | { cells?: Array<{ columnId: number; value?: unknown; displayValue?: unknown }> }
    | undefined;
  if (!row) return null;

  const approved = new Set(wf.approvedValues.map((v) => v.toLowerCase()));
  const declined = new Set(wf.declinedValues.map((v) => v.toLowerCase()));

  for (const st of stages) {
    const cell = (row.cells ?? []).find((c) => c.columnId === st.columnId);
    const value = String(cell?.value ?? cell?.displayValue ?? "").trim();
    const lv = value.toLowerCase();
    if (!value) return st;
    if (declined.has(lv)) return null;
    if (!approved.has(lv)) return st;
  }
  return null;
}

/** Stages that are not yet approved (current pending + upcoming) — eligible for contact reroute. */
export async function findEditableContactStages(
  sheet: { id?: string | number; columns?: unknown[]; rows?: unknown[] },
  rowId: number,
): Promise<Array<{ name: string; columnId: number; isCurrent: boolean }>> {
  const wf = await resolveWorkflow(sheet);
  const stages = await stageColumns(sheet);
  const row = (sheet.rows ?? []).find((r) => (r as { id: number }).id === rowId) as
    | { cells?: Array<{ columnId: number; value?: unknown; displayValue?: unknown }> }
    | undefined;
  if (!row) return [];

  const approved = new Set(wf.approvedValues.map((v) => v.toLowerCase()));
  const declined = new Set(wf.declinedValues.map((v) => v.toLowerCase()));
  const result: Array<{ name: string; columnId: number; isCurrent: boolean }> = [];
  let foundCurrent = false;

  for (const st of stages) {
    const cell = (row.cells ?? []).find((c) => c.columnId === st.columnId);
    const value = String(cell?.value ?? cell?.displayValue ?? "").trim();
    const lv = value.toLowerCase();
    if (value && declined.has(lv)) break;
    if (value && approved.has(lv)) continue;
    // blank or non-approved → editable
    const isCurrent = !foundCurrent;
    foundCurrent = true;
    result.push({ ...st, isCurrent });
  }
  return result;
}

export async function validateWorkflowValue(
  sheet: { id?: string | number; columns?: unknown[] },
  columnTitle: string,
  value: string,
): Promise<string | null> {
  const sheetId = sheet?.id != null ? String(sheet.id) : undefined;
  const wf = await loadWorkflow(sheetId);
  const allowedTitles = new Set([
    ...wf.approvalStages.map((s) => s.toLowerCase()),
    wf.overallColumn.toLowerCase(),
  ]);
  if (!allowedTitles.has(columnTitle.toLowerCase())) {
    return `Column "${columnTitle}" is not writable via the tracker.`;
  }
  const col = (sheet.columns ?? []).find((c) => String((c as { title: unknown }).title).toLowerCase() === columnTitle.toLowerCase()) as
    | { options?: string[] }
    | undefined;
  if (!col) return `Column "${columnTitle}" not found on sheet.`;
  if (col.options?.length && !col.options.includes(value)) {
    return `Invalid value "${value}" for ${columnTitle}. Allowed: ${col.options.join(", ")}`;
  }
  return null;
}

export async function approvedValue(sheet: { id?: string | number; columns?: unknown[] }): Promise<string> {
  const wf = await resolveWorkflow(sheet);
  return wf.approvedValues[0] ?? "Approved";
}

export async function declinedValue(sheet: { id?: string | number; columns?: unknown[] }): Promise<string> {
  const wf = await resolveWorkflow(sheet);
  return wf.declinedValues[0] ?? "Declined";
}
