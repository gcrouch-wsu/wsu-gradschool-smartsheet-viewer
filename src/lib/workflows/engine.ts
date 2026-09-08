import type { SmartsheetCell, SmartsheetRow, ViewFilterConfig } from "@/lib/config/types";
import { applyViewFilters } from "@/lib/filters";
import * as ss from "@/lib/forms/smartsheet-api";
import { includedFields, mergeTemplate, type MergeField } from "@/lib/workflows/merge";
import { emailsFromContactCell, extractEmails, normalizeEmail } from "@/lib/workflows/recipients";
import { insertNotifications } from "@/lib/workflows/notifications";
import { insertWorkflowRun, listEnabledRunnableWorkflows, updateWorkflowRun } from "@/lib/workflows/store";
import type { TriggerEvent, WorkflowRecord } from "@/lib/workflows/types";

export interface WebhookWorkflowEvent {
  sheetId: number;
  eventType: string;
  objectType?: string;
  objectId: number;
  rowId?: number;
  columnId?: number;
  timestamp?: string;
}

const DELETE_EVENTS = /delet/i;

function cellText(cell: { displayValue?: unknown; value?: unknown; objectValue?: unknown } | undefined): string {
  if (!cell) return "";
  const emails = emailsFromContactCell(cell);
  if (emails.length) return emails.join(", ");
  const value = cell.displayValue ?? cell.value;
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (value == null) return "";
  return String(value);
}

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

function resolveRowId(event: WebhookWorkflowEvent, mapped: TriggerEvent): number | null {
  if (event.rowId && event.rowId > 0) return event.rowId;
  if (mapped !== "columns_changed" && event.objectId > 0) return event.objectId;
  if (event.objectId > 0 && !event.columnId) return event.objectId;
  return event.objectId > 0 ? event.objectId : null;
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
  rowId: number,
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
  return { id: rowId, cellsById, cellsByTitle: {} };
}

function eventKey(event: WebhookWorkflowEvent, rowId: number | null): string {
  const stamp = event.timestamp ? Date.parse(event.timestamp) : Date.now();
  const bucket = Number.isFinite(stamp) ? Math.floor(stamp / 60_000) : Math.floor(Date.now() / 60_000);
  return `${event.eventType}:${event.objectType ?? "row"}:${event.objectId}:${rowId ?? 0}:${event.columnId ?? 0}:${bucket}`;
}

export function rowMatchesConditions(row: SmartsheetRow, conditions: ViewFilterConfig[]): boolean {
  if (!conditions.length) return true;
  return applyViewFilters([row], conditions).length === 1;
}

export async function evaluateWebhookEvents(events: WebhookWorkflowEvent[]): Promise<void> {
  for (const event of events) {
    try {
      await evaluateOne(event);
    } catch {
      // One failed event must not block the rest.
    }
  }
}

async function evaluateOne(event: WebhookWorkflowEvent): Promise<void> {
  if (!Number.isFinite(event.sheetId) || event.sheetId <= 0) return;
  const mapped = mapEventToTrigger(event);
  if (!mapped) return;

  const workflows = await listEnabledRunnableWorkflows(String(event.sheetId));
  const matching = workflows.filter((workflow) => triggerMatches(workflow, mapped, event.columnId));
  if (!matching.length) return;

  const rowId = resolveRowId(event, mapped);
  if (!rowId) return;

  let raw: {
    id?: number;
    cells?: Array<{ columnId: number; value?: unknown; displayValue?: unknown; objectValue?: unknown }>;
  };
  try {
    raw = (await ss.getRow(event.sheetId, rowId)) as typeof raw;
  } catch {
    return;
  }

  const columns = await loadColumnTitles(event.sheetId);
  const filterRow = toFilterRow(rowId, raw.cells ?? []);
  const fields = buildFields(columns, raw.cells ?? []);
  const href = `/forms/sheet?sheetId=${encodeURIComponent(String(event.sheetId))}&rowId=${rowId}`;

  for (const workflow of matching) {
    if (!rowMatchesConditions(filterRow, workflow.conditions)) continue;
    const key = eventKey(event, rowId);
    const run = await insertWorkflowRun({
      workflowId: workflow.id,
      sheetId: String(event.sheetId),
      rowId,
      eventKey: key,
      status: "pending",
    });
    if (!run) continue;

    try {
      const emails = resolveRecipients(workflow, raw.cells ?? []);
      if (!emails.length) {
        await updateWorkflowRun(run.id, "skipped", "No recipients.");
        continue;
      }
      const title = mergeTemplate(workflow.action.title || workflow.name, fields, { Primary: fields[0]?.value ?? "" });
      const body = mergeTemplate(workflow.action.body || "", fields);
      const shown = includedFields(fields, workflow.action.includeColumnIds ?? [], columns.idByTitle);
      await insertNotifications({
        emails,
        title: title || workflow.name,
        body,
        payload: {
          sheetId: String(event.sheetId),
          rowId,
          href,
          fields: shown,
          templateKind: workflow.templateKind,
        },
        workflowId: workflow.id,
        runId: run.id,
      });
      await updateWorkflowRun(run.id, "sent");
    } catch (error) {
      await updateWorkflowRun(run.id, "failed", error instanceof Error ? error.message : "Workflow failed.");
    }
  }
}

function resolveRecipients(
  workflow: WorkflowRecord,
  cells: Array<{ columnId: number; value?: unknown; displayValue?: unknown; objectValue?: unknown }>,
): string[] {
  const emails = new Set<string>();
  for (const email of workflow.action.recipients?.userEmails ?? []) {
    const normalized = normalizeEmail(email);
    if (normalized) emails.add(normalized);
  }
  const contactId = workflow.action.recipients?.contactColumnId;
  if (contactId) {
    const cell = cells.find((cell) => cell.columnId === contactId);
    for (const email of emailsFromContactCell(cell)) emails.add(email);
  }
  return [...emails];
}

function buildFields(
  columns: { titles: Map<number, string> },
  cells: Array<{ columnId: number; value?: unknown; displayValue?: unknown; objectValue?: unknown }>,
): MergeField[] {
  return cells.map((cell) => ({
    title: columns.titles.get(cell.columnId) ?? `Column ${cell.columnId}`,
    value: cellText(cell),
  }));
}

const columnCache = new Map<string, { at: number; titles: Map<number, string>; idByTitle: Map<string, number> }>();

async function loadColumnTitles(sheetId: number) {
  const key = String(sheetId);
  const cached = columnCache.get(key);
  if (cached && Date.now() - cached.at < 60_000) return cached;
  const columns = (await ss.listColumns(sheetId)) as Array<{ id: number; title?: string }>;
  const titles = new Map<number, string>();
  const idByTitle = new Map<string, number>();
  for (const column of columns) {
    const title = String(column.title ?? "");
    titles.set(column.id, title);
    idByTitle.set(title, column.id);
  }
  const next = { at: Date.now(), titles, idByTitle };
  columnCache.set(key, next);
  return next;
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
