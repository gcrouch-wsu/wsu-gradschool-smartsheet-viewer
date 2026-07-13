import { resolveWorkflow } from "@/lib/forms/workflow";

type StepDisplay = "done" | "current" | "declined" | "upcoming";

/** Resolve stage columns on a sheet using the dynamic workflow for that sheet. */
export async function stageColumns(sheet: { columns?: unknown[] }): Promise<{ name: string; columnId: number }[]> {
  const wf = await resolveWorkflow(sheet);
  const titleToId = new Map<string, number>(
    (sheet.columns ?? []).map((c) => {
      const col = c as { title: unknown; id: number };
      return [String(col.title).toLowerCase(), col.id] as [string, number];
    }),
  );
  return wf.approvalStages
    .map((name) => ({ name, columnId: titleToId.get(name.toLowerCase()) }))
    .filter((s): s is { name: string; columnId: number } => typeof s.columnId === "number");
}

export interface SubmissionStep {
  name: string;
  value: string;
  display: StepDisplay;
}

export interface ApprovalStatus {
  /** Human label, e.g. "Waiting at CHR Approval". */
  label: string;
  /** Stage column name where routing stopped, if any. */
  stage: string;
  /** Raw cell value at that stage. */
  value: string;
  /** done | current | declined | complete | not-started */
  state: "done" | "current" | "declined" | "complete" | "not-started";
}

export interface Submission {
  rowId: number;
  label: string;
  email: string;
  createdAt: string | null;
  stages: SubmissionStep[];
  overall: string;
  approvalStatus: ApprovalStatus;
}

function shortStageName(title: string): string {
  return title.replace(/\s*status$/i, "").replace(/\s*approval$/i, "").trim();
}

function resolveApprovalStatus(
  stages: { name: string; value: string; display: StepDisplay }[],
): ApprovalStatus {
  const declined = stages.find((s) => s.display === "declined");
  if (declined) {
    return {
      label: `Declined at ${shortStageName(declined.name)}`,
      stage: declined.name,
      value: declined.value,
      state: "declined",
    };
  }

  if (stages.length > 0 && stages.every((s) => s.display === "done")) {
    const last = stages[stages.length - 1];
    return {
      label: "All approvals complete",
      stage: last.name,
      value: last.value,
      state: "complete",
    };
  }

  const current = stages.find((s) => s.display === "current");
  if (current) {
    const status = current.value || "Pending";
    return {
      label: `Waiting at ${shortStageName(current.name)}`,
      stage: current.name,
      value: status,
      state: "current",
    };
  }

  if (stages.length === 0) {
    return { label: "No approval stages configured", stage: "", value: "", state: "not-started" };
  }

  return { label: "Not started", stage: stages[0]?.name ?? "", value: "", state: "not-started" };
}

/**
 * Reads the approval-status columns off each row and computes where the chain
 * has reached. "Where it is now" = the first stage that isn't yet approved.
 */
export async function buildSubmissions(sheet: { columns?: unknown[]; rows?: unknown[] }): Promise<Submission[]> {
  const wf = await resolveWorkflow(sheet);
  const columns = (sheet.columns ?? []) as Array<{ id: number; title: string; primary?: boolean }>;

  const titleToId = new Map<string, number>(
    columns.map((c) => [String(c.title).toLowerCase(), c.id] as [string, number]),
  );
  const primaryId = columns.find((c) => c.primary)?.id;
  const emailId = columns.find((c) => /e-?mail/i.test(c.title))?.id;

  const approved = new Set(wf.approvedValues.map((v) => v.toLowerCase()));
  const declined = new Set(wf.declinedValues.map((v) => v.toLowerCase()));

  return (sheet.rows ?? []).map((row): Submission => {
    const r = row as {
      id: number;
      createdAt?: string;
      cells?: Array<{ columnId: number; value?: unknown; displayValue?: unknown }>;
    };

    const valueOf = (colId?: number): string => {
      if (!colId) return "";
      const cell = (r.cells ?? []).find((c) => c.columnId === colId);
      return cell ? String(cell.value ?? cell.displayValue ?? "").trim() : "";
    };

    const stages = wf.approvalStages.map((title) => {
      const value = valueOf(titleToId.get(title.toLowerCase()));
      const lv = value.toLowerCase();
      let raw: "approved" | "declined" | "pending" | "blank";
      if (!value) raw = "blank";
      else if (approved.has(lv)) raw = "approved";
      else if (declined.has(lv)) raw = "declined";
      else raw = "pending";
      return { name: title, value, raw };
    });

    let settled = false;
    const display: StepDisplay[] = stages.map((s) => {
      if (settled) return "upcoming";
      if (s.raw === "approved") return "done";
      if (s.raw === "declined") {
        settled = true;
        return "declined";
      }
      settled = true;
      return "current";
    });

    const stageSteps = stages.map((s, i) => ({ name: s.name, value: s.value, display: display[i] }));
    const approvalStatus = resolveApprovalStatus(stageSteps);

    const overallExplicit = wf.overallColumn ? valueOf(titleToId.get(wf.overallColumn.toLowerCase())) : "";
    let overall = overallExplicit;
    if (!overall) {
      if (approvalStatus.state === "declined") overall = "Declined";
      else if (approvalStatus.state === "complete") overall = "Complete";
      else if (approvalStatus.state === "current") {
        overall = approvalStatus.value ? `${shortStageName(approvalStatus.stage)}: ${approvalStatus.value}` : "In review";
      } else overall = "In review";
    }

    return {
      rowId: r.id,
      label: valueOf(primaryId) || `Row ${r.id}`,
      email: valueOf(emailId),
      createdAt: r.createdAt ?? null,
      stages: stageSteps,
      overall,
      approvalStatus,
    };
  });
}
