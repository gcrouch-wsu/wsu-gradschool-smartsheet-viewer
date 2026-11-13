import * as ss from "@/lib/forms/smartsheet-api";
import { cellsMatchConditions } from "@/lib/workflows/engine";
import { notifyGroupedRows, performWorkflowAction } from "@/lib/workflows/execute-action";
import { pacificClock, scheduleIsDue } from "@/lib/workflows/retry-policy";
import {
  claimDueRetries,
  getWorkflow,
  getWorkflowRun,
  hasScheduleRun,
  insertWorkflowRun,
  listAllEnabledWorkflows,
  markWorkflowRunFailed,
  takePendingRows,
  updateWorkflowRun,
} from "@/lib/workflows/store";
import type { WorkflowRecord } from "@/lib/workflows/types";

type Cell = { columnId: number; value?: unknown; displayValue?: unknown; objectValue?: unknown };
type SheetRow = { id?: string | number; cells?: Cell[] };

const NOTIFY_KINDS = new Set(["alert", "request_update", "request_update_weekly", "request_approval"]);

let ticking = false;
let timer: ReturnType<typeof setInterval> | null = null;

export function startWorkflowScheduler(): void {
  if (timer || process.env.NODE_ENV === "test") return;
  timer = setInterval(() => {
    void tickWorkflows();
  }, 15_000);
  timer.unref?.();
}

export async function tickWorkflows(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    await retryFailedRuns();
    await runDueSchedules();
  } catch {
    // The next tick tries again. A failed automation stays visible on its run.
  } finally {
    ticking = false;
  }
}

async function retryFailedRuns(): Promise<void> {
  const due = await claimDueRetries();
  for (const run of due) {
    const workflow = await getWorkflow(run.workflowId);
    if (!workflow) {
      await markWorkflowRunFailed(run.id, run.attemptCount, "The workflow is no longer available.");
      continue;
    }
    if (!run.rowId) {
      if (run.eventKey.startsWith("schedule:")) {
        await runSchedule(workflow, run.id, run.attemptCount);
        continue;
      }
      await markWorkflowRunFailed(run.id, run.attemptCount, "The row is no longer available.");
      continue;
    }
    try {
      const raw = (await ss.getRow(run.sheetId, run.rowId)) as { cells?: Cell[] };
      await performWorkflowAction({
        workflow,
        runId: run.id,
        attemptCount: run.attemptCount,
        rowId: run.rowId,
        cells: raw.cells ?? [],
      });
    } catch (error) {
      await markWorkflowRunFailed(run.id, run.attemptCount, error instanceof Error ? error.message : "Workflow failed.");
    }
  }
}

async function runDueSchedules(): Promise<void> {
  const now = new Date();
  const clock = pacificClock(now);
  const workflows = await listAllEnabledWorkflows();
  for (const workflow of workflows) {
    const scheduled = workflow.templateKind === "request_update_weekly" || workflow.trigger.delivery === "batched";
    if (!scheduled) continue;
    const schedule = workflow.trigger.schedule ?? { day: "Every day", time: "09:00" };
    const fired = await hasScheduleRun(workflow.id, clock.dateKey);
    if (!scheduleIsDue(schedule, now, fired)) continue;
    const run = await insertWorkflowRun({
      workflowId: workflow.id,
      sheetId: workflow.sheetId,
      rowId: null,
      eventKey: `schedule:${clock.dateKey}`,
      status: "pending",
      source: "schedule",
    });
    if (!run) continue;
    try {
      await runSchedule(workflow, run.id, run.attemptCount);
    } catch (error) {
      await markWorkflowRunFailed(run.id, run.attemptCount, error instanceof Error ? error.message : "Workflow failed.");
    }
  }
}

async function runSchedule(workflow: WorkflowRecord, runId: string, attemptCount: number): Promise<void> {
  const sheet = (await ss.getSheet(workflow.sheetId)) as { rows?: SheetRow[] };
  let rows = sheet.rows ?? [];
  if (workflow.trigger.delivery === "batched" && workflow.templateKind !== "request_update_weekly") {
    const pending = new Set(await takePendingRows(workflow.id));
    rows = rows.filter((row) => row.id != null && pending.has(String(row.id)));
  }
  const matched = rows.filter(
    (row) => row.id != null && cellsMatchConditions(row.id, row.cells ?? [], workflow.conditions),
  );
  if (!matched.length) {
    await updateWorkflowRun(runId, "skipped", "No matching rows.");
    return;
  }
  if (NOTIFY_KINDS.has(workflow.templateKind)) {
    await notifyGroupedRows({
      workflow,
      runId,
      attemptCount,
      rows: matched.map((row) => ({ rowId: String(row.id), cells: row.cells ?? [] })),
    });
    return;
  }
  for (const row of matched) {
    if (row.id == null) continue;
    await performWorkflowAction({
      workflow,
      runId,
      attemptCount,
      rowId: row.id,
      cells: row.cells ?? [],
    });
    const current = await getWorkflowRun(runId);
    if (current?.status === "failed") return;
  }
}
