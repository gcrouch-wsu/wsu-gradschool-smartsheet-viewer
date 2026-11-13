import type { SmartsheetCell, SmartsheetRow, ViewFilterConfig } from "@/lib/config/types";
import { applyViewFilters } from "@/lib/filters";
import * as ss from "@/lib/forms/smartsheet-api";
import { extractEmails } from "@/lib/workflows/recipients";
import { performWorkflowAction } from "@/lib/workflows/execute-action";
import { enqueuePendingRow, insertWorkflowRun, listEnabledRunnableWorkflows, markWorkflowRunFailed } from "@/lib/workflows/store";
import type { TriggerEvent, WorkflowRecord } from "@/lib/workflows/types";

export interface WebhookWorkflowEvent {
  sheetId: string | number;
  eventType: string;
  objectType?: string;
  objectId: string | number;
  rowId?: string | number;
  columnId?: number;
  timestamp?: string;
  /** Set when this process wrote the row while running a workflow. */
  origin?: "workflow";
}

const DELETE_EVENTS = /delet/i;

function mapEventToTrigger(event: WebhookWorkflowEvent): TriggerEvent | null {
  if (DELETE_EVENTS.test(event.eventType) || DELETE_EVENTS.test(event.objectType ?? "")) return null;
  const type = `${event.objectType ?? ""} ${event.eventType}`.toLowerCase();
  if (type.includes("created") && (type.includes("row") || !event.objectType)) return "row_created";
  if (event.columnId) return "columns_changed";
  if (type.includes("cell")) return "columns_changed";
  if (type.includes("created")) return "row_created";
  if (type.includes("updated") || type.includes("changed")) return "row_updated";
  return "row_updated";
}

function isPresentId(value: string | number | undefined): value is string | number {
  if (value === undefined || value === null || value === "") return false;
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  return Boolean(String(value).trim());
}

function resolveRowId(event: WebhookWorkflowEvent, mapped: TriggerEvent): string | number | null {
  if (isPresentId(event.rowId)) return event.rowId;
  if (mapped !== "columns_changed" && isPresentId(event.objectId)) return event.objectId;
  if (isPresentId(event.objectId) && !event.columnId) return event.objectId;
  return isPresentId(event.objectId) ? event.objectId : null;
}

function triggerMatches(workflow: WorkflowRecord, mapped: TriggerEvent, columnId?: number): boolean {
  if (workflow.trigger.event === "row_updated") {
    return mapped === "row_updated" || mapped === "columns_changed" || mapped === "row_created";
  }
  if (workflow.trigger.event === "row_created") return mapped === "row_created";
  if (workflow.trigger.event === "columns_changed") {
    const watched = workflow.trigger.columnIds ?? [];
    if (columnId && watched.length > 0 && !watched.includes(columnId)) return false;
    return mapped === "columns_changed" || mapped === "row_updated";
  }
  return false;
}

function toFilterRow(
  rowId: string | number,
  cells: Array<{ columnId: number; value?: unknown; displayValue?: unknown; objectValue?: unknown }>,
): SmartsheetRow {
  const cellsById: Record<number, SmartsheetCell> = {};
  for (const cell of cells) {
    cellsById[cell.columnId] = {
      columnId: cell.columnId,
      columnTitle: "",
      columnType: "",
      value: cell.value,
      displayValue: cell.displayValue != null ? String(cell.displayValue) : undefined,
      objectValue: cell.objectValue,
    };
  }
  const numericId = typeof rowId === "number" ? rowId : Number(rowId);
  return {
    id: Number.isFinite(numericId) ? numericId : 0,
    cellsById,
    cellsByTitle: {},
  };
}

function eventKey(event: WebhookWorkflowEvent, rowId: string | number | null): string {
  const stamp = event.timestamp ? Date.parse(event.timestamp) : Date.now();
  const bucket = Number.isFinite(stamp) ? Math.floor(stamp / 60_000) : Math.floor(Date.now() / 60_000);
  return `${event.eventType}:${event.objectType ?? "row"}:${event.objectId}:${rowId ?? 0}:${event.columnId ?? 0}:${bucket}`;
}

export function rowMatchesConditions(row: SmartsheetRow, conditions: ViewFilterConfig[]): boolean {
  if (!conditions.length) return true;
  return applyViewFilters([row], conditions).length === 1;
}

export function cellsMatchConditions(
  rowId: string | number,
  cells: Array<{ columnId: number; value?: unknown; displayValue?: unknown; objectValue?: unknown }>,
  conditions: ViewFilterConfig[],
): boolean {
  return rowMatchesConditions(toFilterRow(rowId, cells), conditions);
}

export async function evaluateWebhookEvents(events: WebhookWorkflowEvent[]): Promise<void> {
  const { tickWorkflows } = await import("@/lib/workflows/scheduler");
  void tickWorkflows();
  for (const event of events) {
    try {
      await evaluateOne(event);
    } catch {
      // One failed event must not block the rest.
    }
  }
}

async function evaluateOne(event: WebhookWorkflowEvent): Promise<void> {
  if (event.origin === "workflow") return;
  if (!isPresentId(event.sheetId)) return;
  const mapped = mapEventToTrigger(event);
  if (!mapped) return;

  const workflows = await listEnabledRunnableWorkflows(String(event.sheetId));
  const matching = workflows.filter((workflow) => triggerMatches(workflow, mapped, event.columnId));
  if (!matching.length) return;

  const rowId = resolveRowId(event, mapped);
  if (!rowId) return;

  let raw: {
    id?: string | number;
    cells?: Array<{ columnId: number; value?: unknown; displayValue?: unknown; objectValue?: unknown }>;
  };
  try {
    raw = (await ss.getRow(event.sheetId, rowId)) as typeof raw;
  } catch {
    return;
  }

  const filterRow = toFilterRow(rowId, raw.cells ?? []);

  for (const workflow of matching) {
    if (workflow.templateKind === "request_update_weekly") continue;
    if (!rowMatchesConditions(filterRow, workflow.conditions)) continue;
    if (workflow.trigger.delivery === "batched") {
      await enqueuePendingRow(workflow.id, rowId);
      continue;
    }
    const key = eventKey(event, rowId);
    const run = await insertWorkflowRun({
      workflowId: workflow.id,
      sheetId: String(event.sheetId),
      rowId,
      eventKey: key,
      status: "pending",
      source: "webhook",
    });
    if (!run) continue;
    try {
      await performWorkflowAction({
        workflow,
        runId: run.id,
        attemptCount: run.attemptCount,
        rowId,
        cells: raw.cells ?? [],
      });
    } catch (error) {
      await markWorkflowRunFailed(run.id, run.attemptCount, error instanceof Error ? error.message : "Workflow failed.");
    }
  }
}

export function parseWebhookEvent(raw: unknown, fallbackSheetId: number): WebhookWorkflowEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const ev = raw as Record<string, unknown>;
  const sheetId = Number(ev.sheetId ?? ev.scopeObjectId ?? fallbackSheetId);
  const eventType = String(ev.eventType ?? ev.type ?? "unknown");
  const objectId = Number(ev.id ?? ev.rowId ?? ev.objectId ?? 0);
  if (!Number.isFinite(sheetId) || sheetId <= 0) return null;
  const rowId = Number(ev.rowId ?? 0);
  const columnId = Number(ev.columnId ?? 0);
  return {
    sheetId,
    eventType,
    objectType: ev.objectType != null ? String(ev.objectType) : undefined,
    objectId: Number.isFinite(objectId) ? objectId : 0,
    rowId: Number.isFinite(rowId) && rowId > 0 ? rowId : undefined,
    columnId: Number.isFinite(columnId) && columnId > 0 ? columnId : undefined,
    timestamp: ev.timestamp != null ? String(ev.timestamp) : undefined,
  };
}

export function collectRecipientEmailsFromUnknown(value: unknown): string[] {
  return extractEmails(value);
}
