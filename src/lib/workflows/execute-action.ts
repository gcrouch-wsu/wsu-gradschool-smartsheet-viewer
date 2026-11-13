import { listSourceConfigs } from "@/lib/config/store";
import { resolveWorkflow } from "@/lib/forms/workflow";
import * as ss from "@/lib/forms/smartsheet-api";
import { fieldsFromCells, loadColumnIndex, renderAlertCopy, type ColumnIndex } from "@/lib/workflows/alert-content";
import { deliverWorkflowNotifications } from "@/lib/workflows/deliver";
import { emailsFromContactCell, normalizeEmail } from "@/lib/workflows/recipients";
import {
  markRunNotificationsDecided,
  markWorkflowRunFailed,
  recordWorkflowDecision,
  setWorkflowRowLock,
  updateWorkflowRun,
} from "@/lib/workflows/store";
import type { WorkflowRecord } from "@/lib/workflows/types";
import { notificationHref } from "@/lib/workflows/visible-notifications";
import { runAsWorkflowWrite } from "@/lib/workflows/write-context";
import { insertNotifications } from "@/lib/workflows/notifications";

type Cell = { columnId: number; value?: unknown; displayValue?: unknown; objectValue?: unknown };

export function resolveRecipients(workflow: WorkflowRecord, cells: Cell[]): string[] {
  const emails = new Set<string>();
  for (const email of workflow.action.recipients?.userEmails ?? []) {
    const normalized = normalizeEmail(email);
    if (normalized) emails.add(normalized);
  }
  const contactId = workflow.action.recipients?.contactColumnId;
  if (contactId) {
    const cell = cells.find((entry) => entry.columnId === contactId);
    for (const email of emailsFromContactCell(cell)) emails.add(email);
  }
  return [...emails];
}

async function sheetHref(sheetId: string, rowId: string | number | null): Promise<string | undefined> {
  const sources = await listSourceConfigs();
  const source = sources.find((entry) => entry.sourceType === "sheet" && String(entry.smartsheetId) === sheetId);
  return source ? notificationHref(source, rowId, "staff") : undefined;
}

async function writeCells(sheetId: string, rowId: string | number, cells: Array<{ columnId: number; value?: string | boolean; objectValue?: unknown }>) {
  const numeric = Number(rowId);
  await runAsWorkflowWrite(() =>
    ss.updateRows(sheetId, [
      {
        id: Number.isFinite(numeric) && numeric !== 0 ? numeric : rowId,
        cells: cells.map((cell) =>
          cell.objectValue !== undefined
            ? { columnId: cell.columnId, objectValue: cell.objectValue }
            : { columnId: cell.columnId, value: cell.value ?? "" },
        ),
      },
    ]),
  );
}

async function notify(input: {
  workflow: WorkflowRecord;
  runId: string;
  emails: string[];
  title: string;
  body: string;
  fields: Array<{ title: string; value: string }>;
  rowId: string | number | null;
  decision?: "pending";
}): Promise<"sent" | "failed"> {
  const href = await sheetHref(input.workflow.sheetId, input.rowId);
  const delivered = await deliverWorkflowNotifications({
    emails: input.emails,
    title: input.title,
    body: input.body,
    payload: {
      sheetId: input.workflow.sheetId,
      rowId: input.rowId,
      href,
      fields: input.fields,
      templateKind: input.workflow.templateKind,
      decision: input.decision,
      runId: input.runId,
    },
    workflowId: input.workflow.id,
    runId: input.runId,
    channels: input.workflow.action.channels,
  });
  const inAppOk = delivered.inAppCreated > 0 || delivered.inAppAlready > 0 || !delivered.channels.includes("in_app");
  if (!inAppOk && delivered.emailFailed > 0) {
    throw new Error(delivered.emailError || "Email is not configured.");
  }
  if (delivered.inAppCreated > 0 || delivered.inAppAlready > 0 || delivered.emailQueued > 0) return "sent";
  return "failed";
}

function rendered(workflow: WorkflowRecord, columns: ColumnIndex, cells: Cell[], fallbackBody: string) {
  const fields = fieldsFromCells(columns, cells);
  return renderAlertCopy({
    titleTemplate: workflow.action.title || workflow.name,
    bodyTemplate: workflow.action.body || fallbackBody,
    fallbackTitle: workflow.name,
    fields,
    primaryTitle: columns.primaryTitle,
    includeColumnIds: workflow.action.includeColumnIds,
    idByTitle: columns.idByTitle,
  });
}

export async function performWorkflowAction(input: {
  workflow: WorkflowRecord;
  runId: string;
  attemptCount: number;
  rowId: string | number;
  cells: Cell[];
}): Promise<void> {
  const { workflow, runId, rowId, cells } = input;
  const columns = await loadColumnIndex(workflow.sheetId);
  const kind = workflow.templateKind;

  try {
    if (kind === "alert" || kind === "request_update" || kind === "request_approval") {
      const emails = resolveRecipients(workflow, cells);
      if (!emails.length) {
        await updateWorkflowRun(runId, "skipped", "No recipients.");
        return;
      }
      const copy = rendered(
        workflow,
        columns,
        cells,
        kind === "alert" ? "A row changed. Review the details below." : "Please review this row.",
      );
      const outcome = await notify({
        workflow,
        runId,
        emails,
        title: copy.title,
        body: copy.body,
        fields: copy.fields,
        rowId,
        decision: kind === "request_approval" ? "pending" : undefined,
      });
      if (outcome === "failed") {
        await updateWorkflowRun(runId, "skipped", "No notifications delivered.");
        return;
      }
      await updateWorkflowRun(runId, kind === "request_approval" ? "waiting" : "sent");
      return;
    }

    if (kind === "change_cell" || kind === "record_date" || kind === "assign_someone") {
      const columnId = workflow.action.columnId;
      if (!columnId) throw new Error("Choose a column.");
      if (kind === "assign_someone") {
        const emails = resolveRecipients(workflow, cells);
        const email = emails[0];
        if (!email) {
          await updateWorkflowRun(runId, "skipped", "No recipients.");
          return;
        }
        await writeCells(workflow.sheetId, rowId, [
          { columnId, objectValue: { objectType: "CONTACT", email } },
        ]);
      } else if (kind === "record_date") {
        const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
        await writeCells(workflow.sheetId, rowId, [{ columnId, value: today }]);
      } else {
        await writeCells(workflow.sheetId, rowId, [{ columnId, value: workflow.action.value ?? "" }]);
      }
      await updateWorkflowRun(runId, "sent");
      return;
    }

    if (kind === "allow_row_changes" || kind === "prevent_row_changes") {
      const locked = kind === "prevent_row_changes";
      await setWorkflowRowLock(workflow.sheetId, rowId, locked);
      const numeric = Number(rowId);
      if (Number.isFinite(numeric) && numeric !== 0) {
        await runAsWorkflowWrite(() => ss.setRowsLocked(workflow.sheetId, [numeric], locked)).catch(() => {
          /* Imported sheets keep the lock in workflow_row_locks. */
        });
      }
      await updateWorkflowRun(runId, "sent");
      return;
    }

    if (kind === "move_row" || kind === "copy_row") {
      const target = workflow.action.targetSheetId?.trim();
      if (!target) throw new Error("Choose a destination sheet.");
      const numeric = Number(rowId);
      const targetNumeric = Number(target);
      if (!Number.isFinite(numeric) || !Number.isFinite(targetNumeric)) {
        throw new Error("Move and copy need numeric Smartsheet ids.");
      }
      await runAsWorkflowWrite(async () => {
        if (kind === "move_row") await ss.moveRows(workflow.sheetId, [numeric], targetNumeric);
        else await ss.copyRows(workflow.sheetId, [numeric], targetNumeric);
      });
      await updateWorkflowRun(runId, "sent");
      return;
    }

    await updateWorkflowRun(runId, "skipped", "This workflow has no action.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workflow failed.";
    await markWorkflowRunFailed(runId, input.attemptCount, message);
  }
}

export async function notifyGroupedRows(input: {
  workflow: WorkflowRecord;
  runId: string;
  attemptCount: number;
  rows: Array<{ rowId: string; cells: Cell[] }>;
}): Promise<void> {
  try {
    const columns = await loadColumnIndex(input.workflow.sheetId);
    const emails = new Set<string>();
    const lines: string[] = [];
    for (const row of input.rows) {
      for (const email of resolveRecipients(input.workflow, row.cells)) emails.add(email);
      const fields = fieldsFromCells(columns, row.cells);
      const label = columns.primaryTitle
        ? fields.find((field) => field.title === columns.primaryTitle)?.value
        : fields[0]?.value;
      lines.push(label || `Row ${row.rowId}`);
    }
    if (!emails.size) {
      await updateWorkflowRun(input.runId, "skipped", "No recipients.");
      return;
    }
    const preview = lines.slice(0, 20).map((line) => `• ${line}`).join("\n");
    const extra = lines.length > 20 ? `\n${lines.length - 20} more rows.` : "";
    const outcome = await notify({
      workflow: input.workflow,
      runId: input.runId,
      emails: [...emails],
      title: input.workflow.action.title || input.workflow.name,
      body: `${input.workflow.action.body || "These rows need attention."}\n\n${preview}${extra}`,
      fields: lines.slice(0, 12).map((line) => ({ title: "Row", value: line })),
      rowId: input.rows[0]?.rowId ?? null,
      decision: input.workflow.templateKind === "request_approval" ? "pending" : undefined,
    });
    if (outcome === "failed") {
      await updateWorkflowRun(input.runId, "skipped", "No notifications delivered.");
      return;
    }
    await updateWorkflowRun(input.runId, input.workflow.templateKind === "request_approval" ? "waiting" : "sent");
  } catch (error) {
    await markWorkflowRunFailed(input.runId, input.attemptCount, error instanceof Error ? error.message : "Workflow failed.");
  }
}

export async function completeApproval(input: {
  runId: string;
  workflow: WorkflowRecord;
  rowId: string | null;
  decision: "approved" | "declined";
  decidedBy: string;
  comment?: string | null;
}): Promise<void> {
  await recordWorkflowDecision({
    runId: input.runId,
    decision: input.decision,
    decidedBy: input.decidedBy,
    comment: input.comment,
  });
  await markRunNotificationsDecided(input.runId, input.decision);
  await updateWorkflowRun(input.runId, "sent");

  if (input.rowId) {
    const sheet = await ss.getSheet(input.workflow.sheetId).catch(() => null);
    if (sheet) {
      const resolved = await resolveWorkflow(sheet as { id?: string | number; columns?: unknown[] });
      const columns = ss.extractColumns(sheet as { columns?: unknown[] });
      const preferred = input.workflow.action.columnId;
      const stage = resolved.approvalStages[0];
      const column = preferred
        ? columns.find((entry) => entry.id === preferred)
        : columns.find((entry) => entry.title === stage);
      if (column) {
        await writeCells(input.workflow.sheetId, input.rowId, [
          { columnId: column.id, value: input.decision === "approved" ? "Approved" : "Declined" },
        ]).catch(() => {
          /* The decision is already stored if the sheet rejects the value. */
        });
      }
    }
  }

  const requester = normalizeEmail(input.workflow.createdByEmail ?? "");
  if (requester) {
    await insertNotifications({
      emails: [requester],
      title: `${input.workflow.name} ${input.decision}`,
      body: input.comment?.trim() || `The row was ${input.decision}.`,
      payload: {
        sheetId: input.workflow.sheetId,
        rowId: input.rowId,
        href: await sheetHref(input.workflow.sheetId, input.rowId),
        fields: [],
        templateKind: input.workflow.templateKind,
        decision: input.decision,
        runId: input.runId,
      },
      workflowId: input.workflow.id,
      runId: input.runId,
    });
  }
}
