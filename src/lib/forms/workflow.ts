import type { Workflow } from "@/lib/forms/config";
import { loadWorkflow } from "@/lib/forms/store/workflow-config";

export type WorkflowSource = "config" | "auto";

export interface ResolvedWorkflow extends Workflow {
  /** How approval stages were chosen for this sheet. */
  source: WorkflowSource;
}

const SYSTEM_TYPES = new Set([
  "CREATED_DATE",
  "MODIFIED_DATE",
  "CREATED_BY",
  "MODIFIED_BY",
  "AUTO_NUMBER",
]);

function columnTitles(sheet: { columns?: unknown[] }): { title: string; column: Record<string, unknown> }[] {
  return (sheet.columns ?? []).map((c) => {
    const column = c as Record<string, unknown>;
    return { title: String(column.title), column };
  });
}

function findTitle(titles: string[], name: string): string {
  const hit = titles.find((t) => t.toLowerCase() === name.toLowerCase());
  return hit ?? name;
}

function hasTitle(titles: string[], name: string): boolean {
  return titles.some((t) => t.toLowerCase() === name.toLowerCase());
}

function detectOverallColumn(titles: string[], configured: string): string {
  if (configured && hasTitle(titles, configured)) return findTitle(titles, configured);
  const patterns = [
    /^overall\s+(stage|status)$/i,
    /^workflow\s+status$/i,
    /^overall$/i,
    /^approvals?\s+ready$/i,
  ];
  for (const t of titles) {
    if (patterns.some((p) => p.test(t))) return t;
  }
  return "";
}

function isApprovalStageColumn(
  title: string,
  overallLower: string,
  excludeLower: Set<string>,
  column: Record<string, unknown>,
): boolean {
  const lower = title.toLowerCase();
  if (!title || lower === overallLower || excludeLower.has(lower)) return false;
  if (/^resend\b/i.test(title)) return false;
  if (/\bapproval\s*date$/i.test(title)) return false;
  if (/^approvals?\s+ready$/i.test(title)) return false;
  if (column.systemColumnType || SYSTEM_TYPES.has(String(column.type))) return false;
  return /\bapproval\b/i.test(title);
}

function detectApprovalStages(
  sheet: { columns?: unknown[] },
  overallLower: string,
  excludeLower: Set<string>,
): string[] {
  return columnTitles(sheet)
    .filter(({ title, column }) => isApprovalStageColumn(title, overallLower, excludeLower, column))
    .map(({ title }) => title);
}

/**
 * Resolve the approval workflow for a sheet. Stages are read from columns whose
 * titles contain "approval" (in sheet order). Stored workflow config supplies value
 * lists and fallback stage names when no approval columns exist.
 */
export async function resolveWorkflow(sheet: { id?: string | number; columns?: unknown[] }): Promise<ResolvedWorkflow> {
  const sheetId = sheet?.id != null ? String(sheet.id) : undefined;
  const base = await loadWorkflow(sheetId);
  const titles = columnTitles(sheet).map((c) => c.title);
  const overallColumn = detectOverallColumn(titles, base.overallColumn);
  const overallLower = overallColumn.toLowerCase();
  const excludeLower = new Set(
    [...base.excludeFromForm, overallColumn].filter(Boolean).map((s) => s.toLowerCase()),
  );

  const autoStages = detectApprovalStages(sheet, overallLower, excludeLower);
  const configuredOnSheet = base.approvalStages.filter((name) => hasTitle(titles, name));

  let approvalStages: string[];
  let source: WorkflowSource;

  if (autoStages.length > 0) {
    approvalStages = autoStages;
    source = "auto";
  } else if (configuredOnSheet.length > 0) {
    approvalStages = configuredOnSheet.map((name) => findTitle(titles, name));
    source = "config";
  } else {
    approvalStages = [];
    source = "auto";
  }

  return {
    ...base,
    approvalStages,
    overallColumn,
    source,
  };
}
