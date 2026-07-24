import { config } from "@/lib/forms/config";
import * as mock from "@/lib/forms/mock-data";
import type { SmartsheetColumn } from "@/lib/forms/types";
import {
  SmartsheetRequestError,
  listAllPages as clientListAllPages,
  listAllTokenPages as clientListAllTokenPages,
  smartsheetRequest,
  type ConnectionConfig,
} from "@/lib/smartsheet-client";
import { normalizeSmartsheetApiBaseUrl } from "@/lib/smartsheet-api-url";

/** Columns Smartsheet fills in automatically — never shown on the form or written to. */
const SYSTEM_COLUMN_TYPES = new Set([
  "CREATED_DATE",
  "MODIFIED_DATE",
  "CREATED_BY",
  "MODIFIED_BY",
  "AUTO_NUMBER",
]);

/** Default columns used when creating a sheet "from scratch" (Mode B). */
export const DEFAULT_COLUMNS = [
  { title: "Full Name", type: "TEXT_NUMBER", primary: true },
  { title: "Email", type: "TEXT_NUMBER" },
  { title: "Department", type: "PICKLIST", options: ["Academics", "Athletics", "Facilities", "IT", "Other"] },
  { title: "Message", type: "TEXT_NUMBER" },
  { title: "Status", type: "PICKLIST", options: ["New", "In Progress", "Done"] },
];

/** Forms connection: prefer config token/base (supports SMARTSHEET_TOKEN alias + demo). */
function formsConnection(): ConnectionConfig {
  return {
    token: config.smartsheetToken,
    apiBaseUrl: normalizeSmartsheetApiBaseUrl(config.smartsheetBaseUrl),
  };
}

/** Preserve Forms error shape (`Error` with `.status` / `.smartsheetErrorCode`) for existing callers. */
async function withFormsErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof SmartsheetRequestError) {
      const err = new Error(`Smartsheet API ${error.status}: ${error.message}`) as Error & {
        status?: number;
        smartsheetErrorCode?: unknown;
      };
      err.status = error.status;
      err.smartsheetErrorCode = error.smartsheetErrorCode;
      throw err;
    }
    throw error;
  }
}

/** Thin wrapper over the canonical Smartsheet client. */
async function api(path: string, init: RequestInit = {}): Promise<unknown> {
  return withFormsErrors(() =>
    smartsheetRequest(path, {
      connection: formsConnection(),
      method: init.method,
      body: init.body,
      headers: init.headers as Record<string, string> | undefined,
      cache: "no-store",
    }),
  );
}

async function listAllPages(path: string, pageSize = 100): Promise<unknown[]> {
  return withFormsErrors(() => clientListAllPages(path, pageSize, { connection: formsConnection() }));
}

async function listAllTokenPages(path: string, maxItems = 100): Promise<unknown[]> {
  return withFormsErrors(() => clientListAllTokenPages(path, maxItems, { connection: formsConnection() }));
}

export interface SheetSummary {
  id: number;
  name: string;
}

/** List every sheet the token can access — used to populate the template dropdown. */
export async function listSheets(): Promise<SheetSummary[]> {
  if (config.demo) return mock.mockListSheets();
  const rows = await listAllPages("/sheets");
  return rows
    .map((s) => {
      const sheet = s as { id: number; name: string };
      return { id: sheet.id, name: sheet.name };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export async function getSheet(sheetId: string | number): Promise<Record<string, unknown>> {
  if (config.demo) return mock.mockGetSheet(sheetId) as unknown as Record<string, unknown>;

  const sheet = (await api(`/sheets/${sheetId}`)) as Record<string, unknown>;
  const pageSize = 5000;
  const rows: unknown[] = [...((sheet.rows as unknown[]) ?? [])];
  const reportedTotal = Math.max((sheet.totalRowCount as number | undefined) ?? 0, rows.length);

  if (reportedTotal > rows.length) {
    let page = rows.length > 0 ? 2 : 1;
    while (rows.length < reportedTotal) {
      const next = (await api(`/sheets/${sheetId}?page=${page}&pageSize=${pageSize}`)) as { rows?: unknown[] };
      const batch = next.rows ?? [];
      if (!batch.length) break;
      rows.push(...batch);
      if (batch.length < pageSize) break;
      page++;
    }
  }

  sheet.rows = rows;
  sheet.totalRowCount = Math.max(reportedTotal, rows.length);
  return sheet;
}

export function extractColumns(sheet: { columns?: unknown[] }): SmartsheetColumn[] {
  return (sheet.columns ?? []).map((c) => {
    const col = c as Record<string, unknown>;
    const formula = typeof col.formula === "string" ? col.formula.trim() : "";
    return {
      id: col.id as number,
      title: col.title as string,
      type: col.type as string,
      options: col.options as string[] | undefined,
      validation: col.validation as boolean | undefined,
      primary: col.primary as boolean | undefined,
      systemColumnType: col.systemColumnType as string | undefined,
      formula: formula || undefined,
    };
  });
}

/** Keep only the columns a person should actually fill in on a form. */
export function formColumns(cols: SmartsheetColumn[], exclude: Set<string> = new Set()): SmartsheetColumn[] {
  return cols.filter(
    (c) => !c.systemColumnType && !SYSTEM_COLUMN_TYPES.has(c.type) && !exclude.has(c.title.toLowerCase()),
  );
}

export async function addRow(
  sheetId: string | number,
  cells: (
    | { columnId: number; value: string | boolean }
    | { columnId: number; objectValue: unknown }
  )[],
): Promise<unknown> {
  if (config.demo) {
    return mock.mockAddRow(
      sheetId,
      cells.map((c) =>
        "value" in c
          ? c
          : {
              columnId: c.columnId,
              value: JSON.stringify((c as { objectValue: unknown }).objectValue),
            },
      ),
    );
  }
  return api(`/sheets/${sheetId}/rows`, {
    method: "POST",
    body: JSON.stringify([{ toBottom: true, cells }]),
  });
}

export async function copySheet(
  templateId: string | number,
  newName: string,
  include: string[],
): Promise<unknown> {
  if (config.demo) return mock.mockCopySheet(templateId, newName);
  const q = include.length ? `?include=${include.join(",")}` : "";
  return api(`/sheets/${templateId}/copy${q}`, {
    method: "POST",
    body: JSON.stringify({ destinationType: "home", newName }),
  });
}

export async function createSheet(
  name: string,
  columns: { title: string; type: string; primary?: boolean; options?: string[] }[],
): Promise<unknown> {
  if (config.demo) return mock.mockCreateSheet(name, columns);
  return api("/sheets", {
    method: "POST",
    body: JSON.stringify({ name, columns }),
  });
}

export async function listAutomationRules(sheetId: string | number): Promise<unknown[]> {
  if (config.demo) return mock.mockListAutomationRules();
  const data = (await api(`/sheets/${sheetId}/automationrules?includeAll=true`)) as { data?: unknown[] };
  return data.data ?? [];
}

export async function getCellHistory(
  sheetId: string | number,
  rowId: string | number,
  columnId: string | number,
): Promise<unknown[]> {
  if (config.demo) return mock.mockCellHistory(sheetId, rowId, columnId);
  const data = (await api(`/sheets/${sheetId}/rows/${rowId}/columns/${columnId}/history?includeAll=true`)) as {
    data?: unknown[];
  };
  return data.data ?? [];
}

export async function getRow(sheetId: string | number, rowId: string | number): Promise<unknown> {
  if (config.demo) return mock.mockGetRow(sheetId, rowId);
  return api(`/sheets/${sheetId}/rows/${rowId}`);
}

export async function updateRows(
  sheetId: string | number,
  rows: { id: number; cells: { columnId: number; value: string | boolean }[] }[],
): Promise<unknown> {
  if (config.demo) return mock.mockUpdateRows(sheetId, rows);
  return api(`/sheets/${sheetId}/rows`, { method: "PUT", body: JSON.stringify(rows) });
}

export async function deleteRows(sheetId: string | number, rowIds: (string | number)[]): Promise<unknown> {
  if (config.demo) return mock.mockDeleteRows(sheetId, rowIds);
  return api(`/sheets/${sheetId}/rows?ids=${rowIds.join(",")}`, { method: "DELETE" });
}

export async function sendUpdateRequest(
  sheetId: string | number,
  payload: { rowIds: number[]; columnIds: number[]; message?: string; sendTo?: { email: string }[] },
): Promise<unknown> {
  if (config.demo) return mock.mockSendUpdateRequest(sheetId, payload);
  return api(`/sheets/${sheetId}/updaterequests`, { method: "POST", body: JSON.stringify(payload) });
}

export async function listAttachments(sheetId: string | number, rowId?: string | number): Promise<unknown[]> {
  if (config.demo) return mock.mockListAttachments(sheetId, rowId);
  const path = rowId ? `/sheets/${sheetId}/rows/${rowId}/attachments` : `/sheets/${sheetId}/attachments`;
  const data = (await api(path)) as { data?: unknown[] };
  return data.data ?? [];
}

export async function attachFile(
  sheetId: string | number,
  rowId: string | number,
  file: Blob,
  fileName: string,
): Promise<unknown> {
  if (config.demo) return mock.mockAttachFile(sheetId, rowId, fileName);
  const form = new FormData();
  form.append("file", file, fileName);
  form.append("parentType", "ROW");
  form.append("parentId", String(rowId));
  return api(`/sheets/${sheetId}/attachments`, { method: "POST", body: form });
}

export async function getAttachment(sheetId: string | number, attachmentId: string | number): Promise<unknown> {
  if (config.demo) return mock.mockGetAttachment(attachmentId);
  return api(`/sheets/${sheetId}/attachments/${attachmentId}`);
}

export async function listDiscussions(sheetId: string | number, rowId: string | number): Promise<unknown[]> {
  if (config.demo) return mock.mockListDiscussions(sheetId, rowId);
  const data = (await api(`/sheets/${sheetId}/rows/${rowId}/discussions?include=comments`)) as { data?: unknown[] };
  return data.data ?? [];
}

export async function addDiscussion(
  sheetId: string | number,
  rowId: string | number,
  text: string,
): Promise<unknown> {
  if (config.demo) return mock.mockAddDiscussion(sheetId, rowId, text);
  return api(`/sheets/${sheetId}/rows/${rowId}/discussions`, {
    method: "POST",
    body: JSON.stringify({ comment: { text } }),
  });
}

export async function listWorkspaces(): Promise<unknown[]> {
  if (config.demo) return mock.mockListWorkspaces();
  return listAllTokenPages("/workspaces");
}

export async function listFolderChildren(folderId: string | number): Promise<unknown[]> {
  if (config.demo) return mock.mockListFolderChildren(folderId);
  const data = (await api(`/folders/${folderId}/children`)) as { data?: unknown[] };
  return data.data ?? [];
}

export async function getSheetPath(sheetId: string | number): Promise<unknown> {
  if (config.demo) return mock.mockGetSheetPath(sheetId);
  return api(`/sheets/${sheetId}/path`);
}

export async function moveSheet(sheetId: string | number, folderId: string | number): Promise<unknown> {
  if (config.demo) return mock.mockMoveSheet(sheetId, folderId);
  return api(`/sheets/${sheetId}`, {
    method: "PUT",
    body: JSON.stringify({ inPersonalWorkspace: false, parentId: Number(folderId) }),
  });
}

export async function shareSheet(
  sheetId: string | number,
  email: string,
  accessLevel: "VIEWER" | "EDITOR" | "ADMIN" = "EDITOR",
): Promise<unknown> {
  if (config.demo) return mock.mockShareSheet(sheetId, email, accessLevel);
  return api(`/sheets/${sheetId}/shares`, {
    method: "POST",
    body: JSON.stringify([{ email, accessLevel }]),
  });
}

export async function listShares(sheetId: string | number): Promise<unknown[]> {
  if (config.demo) return mock.mockListShares(sheetId);
  const data = (await api(`/sheets/${sheetId}/shares`)) as { data?: unknown[] };
  return data.data ?? [];
}

export async function listUsers(): Promise<unknown[]> {
  if (config.demo) return mock.mockListUsers();
  return listAllPages("/users");
}

export async function listGroups(): Promise<unknown[]> {
  if (config.demo) return mock.mockListGroups();
  return listAllPages("/groups");
}

export async function listTemplates(): Promise<unknown[]> {
  if (config.demo) return mock.mockListTemplates();
  const data = (await api("/templates")) as { data?: unknown[] };
  return data.data ?? [];
}

export async function copySheetToFolder(
  templateId: string | number,
  newName: string,
  include: string[],
  destinationFolderId?: string | number,
): Promise<unknown> {
  if (config.demo) return mock.mockCopySheet(templateId, newName);
  const q = include.length ? `?include=${include.join(",")}` : "";
  const body: Record<string, unknown> = { newName };
  if (destinationFolderId) {
    body.destinationType = "folder";
    body.destinationId = Number(destinationFolderId);
  } else if (config.defaultFolderId) {
    body.destinationType = "folder";
    body.destinationId = Number(config.defaultFolderId);
  } else {
    body.destinationType = "home";
  }
  return api(`/sheets/${templateId}/copy${q}`, { method: "POST", body: JSON.stringify(body) });
}

export async function searchAll(query: string): Promise<unknown[]> {
  if (config.demo) return mock.mockSearch(query);
  const data = (await api(`/search?query=${encodeURIComponent(query)}`)) as { results?: unknown[] };
  return data.results ?? [];
}

export async function listEvents(since?: string): Promise<unknown> {
  if (config.demo) return mock.mockListEvents(since);
  const q = since ? `?since=${encodeURIComponent(since)}` : "";
  return api(`/events${q}`);
}

export async function listWebhooks(): Promise<unknown[]> {
  if (config.demo) return mock.mockListWebhooks();
  const data = (await api("/webhooks")) as { data?: unknown[] };
  return data.data ?? [];
}

export async function createWebhook(callbackUrl: string, scopeObjectId: number, events: string[]): Promise<unknown> {
  if (config.demo) return mock.mockCreateWebhook(callbackUrl, scopeObjectId);
  return api("/webhooks", {
    method: "POST",
    body: JSON.stringify({
      name: "WSU Form Sync",
      callbackUrl,
      scope: "sheet",
      scopeObjectId,
      events,
      version: 1,
    }),
  });
}

export async function updateWebhook(webhookId: number, enabled: boolean): Promise<unknown> {
  if (config.demo) return mock.mockUpdateWebhook(webhookId, enabled);
  return api(`/webhooks/${webhookId}`, {
    method: "PUT",
    body: JSON.stringify({ enabled }),
  });
}

export async function deleteWebhook(webhookId: number): Promise<unknown> {
  if (config.demo) return mock.mockDeleteWebhook(webhookId);
  return api(`/webhooks/${webhookId}`, { method: "DELETE" });
}

export async function listColumns(sheetId: string | number): Promise<unknown[]> {
  if (config.demo) return mock.mockListColumns(sheetId);
  const data = (await api(`/sheets/${sheetId}/columns`)) as { data?: unknown[] };
  return data.data ?? [];
}

export async function addColumns(sheetId: string | number, columns: unknown[], index?: number): Promise<unknown> {
  if (config.demo) return mock.mockAddColumns(sheetId, columns as { title: string; type: string; primary?: boolean; options?: string[] }[]);

  // Smartsheet requires `index` on each column object (insert position).
  let startIndex = index;
  if (startIndex === undefined) {
    const existing = await listColumns(sheetId);
    startIndex = existing.length;
  }

  const payload = columns.map((column, offset) => {
    const col = column as Record<string, unknown>;
    const resolvedIndex = typeof col.index === "number" ? col.index : startIndex + offset;
    return { ...col, index: resolvedIndex };
  });

  return api(`/sheets/${sheetId}/columns`, { method: "POST", body: JSON.stringify(payload) });
}

export async function updateColumn(sheetId: string | number, columnId: number, updates: unknown): Promise<unknown> {
  if (config.demo) return mock.mockUpdateColumn(sheetId, columnId, updates as Record<string, unknown>);
  return api(`/sheets/${sheetId}/columns/${columnId}`, { method: "PUT", body: JSON.stringify(updates) });
}

export async function deleteColumn(sheetId: string | number, columnId: number): Promise<unknown> {
  if (config.demo) return mock.mockDeleteColumn(sheetId, columnId);
  return api(`/sheets/${sheetId}/columns/${columnId}`, { method: "DELETE" });
}

export async function copyRows(
  sheetId: string | number,
  rowIds: number[],
  toSheetId: number,
  include?: string,
): Promise<unknown> {
  if (config.demo) return mock.mockCopyRows(rowIds, toSheetId);
  const q = include ? `?include=${include}` : "";
  return api(`/sheets/${sheetId}/rows/copy${q}`, {
    method: "POST",
    body: JSON.stringify({ rowIds, to: { sheetId: toSheetId } }),
  });
}

export async function moveRows(sheetId: string | number, rowIds: number[], toSheetId: number): Promise<unknown> {
  if (config.demo) return mock.mockMoveRows(sheetId, rowIds, toSheetId);
  return api(`/sheets/${sheetId}/rows/move`, {
    method: "POST",
    body: JSON.stringify({ rowIds, to: { sheetId: toSheetId } }),
  });
}

export async function sendRowEmail(
  sheetId: string | number,
  rowIds: number[],
  columnIds: number[],
  recipients: { email: string }[],
  message?: string,
): Promise<unknown> {
  if (config.demo) return mock.mockSendRowEmail(sheetId, rowIds);
  return api(`/sheets/${sheetId}/rows/emails`, {
    method: "POST",
    body: JSON.stringify({ rowIds, columnIds, sendTo: recipients, message }),
  });
}

export async function listReports(): Promise<unknown[]> {
  if (config.demo) return mock.mockListReports();
  return listAllPages("/reports");
}

export async function getReport(reportId: string | number): Promise<unknown> {
  if (config.demo) return mock.mockGetReport(reportId);
  return api(`/reports/${reportId}`);
}

export async function createReport(body: unknown): Promise<unknown> {
  if (config.demo) return mock.mockCreateReport(body as { name?: string });
  return api("/reports", { method: "POST", body: JSON.stringify(body) });
}

export async function updateReport(reportId: string | number, body: unknown): Promise<unknown> {
  if (config.demo) return mock.mockUpdateReport(reportId, body as Record<string, unknown>);
  return api(`/reports/${reportId}`, { method: "PUT", body: JSON.stringify(body) });
}

export async function deleteReport(reportId: string | number): Promise<unknown> {
  if (config.demo) return mock.mockDeleteReport(reportId);
  return api(`/reports/${reportId}`, { method: "DELETE" });
}

export async function listSights(): Promise<unknown[]> {
  if (config.demo) return mock.mockListSights();
  return listAllTokenPages("/sights");
}

export async function getSight(sightId: string | number): Promise<unknown> {
  if (config.demo) return mock.mockGetSight(sightId);
  return api(`/sights/${sightId}`);
}

export async function listForms(sheetId: string | number): Promise<unknown[]> {
  if (config.demo) return mock.mockListForms(sheetId);
  const data = (await api(`/sheets/${sheetId}/forms`)) as { data?: unknown[] };
  return data.data ?? [];
}

export async function getForm(sheetId: string | number, formId: string | number): Promise<unknown> {
  if (config.demo) return mock.mockGetForm(sheetId, formId);
  return api(`/sheets/${sheetId}/forms/${formId}`);
}
