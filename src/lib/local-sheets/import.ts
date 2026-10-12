import { listSourceConfigs } from "@/lib/config/store";
import { listSmartsheetCatalog } from "@/lib/smartsheet";
import { isSmartsheetApiEnabled } from "@/lib/smartsheet-api-gate";
import { resolveConnection, smartsheetRequest } from "@/lib/smartsheet-client";
import { config } from "@/lib/forms/config";
import { normalizeSmartsheetApiBaseUrl } from "@/lib/smartsheet-api-url";
import {
  upsertImportedAttachments,
  upsertImportedAutomations,
  upsertImportedDiscussions,
  upsertImportedReport,
  upsertImportedSheet,
} from "@/lib/local-sheets/store";
import { sheetsDbEnabled } from "@/lib/local-sheets/db";
import type { SheetCellJson } from "@/lib/local-sheets/types";

/** `registered` = only Sources already in this app; `all` = full Smartsheet catalog. */
export type ImportScope = "registered" | "all";

export type ImportSummary = {
  scope: ImportScope;
  sheetsProcessed: number;
  reportsProcessed: number;
  rowsAdded: number;
  rowsSkipped: number;
  automationsAdded: number;
  automationsSkipped: number;
  attachmentsAdded: number;
  discussionsAdded: number;
  errors: string[];
};

function liveConnection() {
  return resolveConnection("default", normalizeSmartsheetApiBaseUrl(config.smartsheetBaseUrl));
}

async function liveApi(path: string): Promise<unknown> {
  return smartsheetRequest(path, { connection: liveConnection(), cache: "no-store" });
}

function cellsFromApi(cells: unknown): SheetCellJson[] {
  if (!Array.isArray(cells)) return [];
  return cells.map((cell) => {
    const c = cell as Record<string, unknown>;
    return {
      columnId: Number(c.columnId),
      value: c.value,
      displayValue: typeof c.displayValue === "string" ? c.displayValue : undefined,
      objectValue: c.objectValue,
      hyperlink: (c.hyperlink as { url?: string } | null | undefined) ?? undefined,
    };
  });
}

async function importSheetAttachmentsAndDiscussions(
  sheetId: number,
  rowIds: number[],
): Promise<{ attachmentsAdded: number; discussionsAdded: number }> {
  let attachmentsAdded = 0;
  let discussionsAdded = 0;

  try {
    const data = (await liveApi(`/sheets/${sheetId}/attachments`)) as { data?: Array<Record<string, unknown>> };
    const sheetAttachments = data.data ?? [];
    const mapped = sheetAttachments
      .filter((item) => typeof item.id === "number")
      .map((item) => ({
        id: item.id as number,
        rowId: typeof item.parentId === "number" ? item.parentId : null,
        name: String(item.name ?? `attachment-${item.id}`),
        mimeType: typeof item.mimeType === "string" ? item.mimeType : null,
        sizeBytes: typeof item.sizeInKb === "number" ? Math.round(item.sizeInKb * 1024) : null,
        url: typeof item.url === "string" ? item.url : null,
        meta: item,
      }));
    const result = await upsertImportedAttachments(sheetId, mapped);
    attachmentsAdded += result.added;
  } catch {
    // Attachment listing can fail on some plans; continue with rows.
  }

  for (const rowId of rowIds.slice(0, 200)) {
    try {
      const data = (await liveApi(`/sheets/${sheetId}/rows/${rowId}/attachments`)) as {
        data?: Array<Record<string, unknown>>;
      };
      const rowAttachments = data.data ?? [];
      const mapped = rowAttachments
        .filter((item) => typeof item.id === "number")
        .map((item) => ({
          id: item.id as number,
          rowId,
          name: String(item.name ?? `attachment-${item.id}`),
          mimeType: typeof item.mimeType === "string" ? item.mimeType : null,
          sizeBytes: typeof item.sizeInKb === "number" ? Math.round(item.sizeInKb * 1024) : null,
          url: typeof item.url === "string" ? item.url : null,
          meta: item,
        }));
      const result = await upsertImportedAttachments(sheetId, mapped);
      attachmentsAdded += result.added;
    } catch {
      // skip
    }

    try {
      const data = (await liveApi(`/sheets/${sheetId}/rows/${rowId}/discussions?include=comments`)) as {
        data?: Array<Record<string, unknown>>;
      };
      const discussions = data.data ?? [];
      const mapped = discussions
        .filter((item) => typeof item.id === "number")
        .map((item) => ({
          id: item.id as number,
          rowId,
          title: typeof item.title === "string" ? item.title : null,
          comments: Array.isArray(item.comments) ? item.comments : [],
          meta: item,
        }));
      const result = await upsertImportedDiscussions(sheetId, mapped);
      discussionsAdded += result.added;
    } catch {
      // skip
    }
  }

  return { attachmentsAdded, discussionsAdded };
}

async function importOneSheet(sheetId: number, nameHint?: string): Promise<{
  rowsAdded: number;
  rowsSkipped: number;
  automationsAdded: number;
  automationsSkipped: number;
  attachmentsAdded: number;
  discussionsAdded: number;
}> {
  // Bypass local store: fetch live from Smartsheet by calling the raw API path via getSheet
  // only when the sheet is not yet considered "local-only". Import always uses live API.
  const sheet = (await fetchLiveSheet(sheetId)) as {
    id?: number;
    name?: string;
    columns?: unknown[];
    rows?: Array<Record<string, unknown>>;
  };

  const rows = (sheet.rows ?? []).map((row) => ({
    id: Number(row.id),
    rowNumber: typeof row.rowNumber === "number" ? row.rowNumber : null,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : null,
    modifiedAt: typeof row.modifiedAt === "string" ? row.modifiedAt : null,
    cells: cellsFromApi(row.cells),
  }));

  const sheetResult = await upsertImportedSheet({
    sheetId: Number(sheet.id ?? sheetId),
    name: String(sheet.name ?? nameHint ?? `Sheet ${sheetId}`),
    columns: sheet.columns ?? [],
    rows,
  });

  let automationsAdded = 0;
  let automationsSkipped = 0;
  try {
    const data = (await liveApi(`/sheets/${sheetId}/automationrules?includeAll=true`)) as {
      data?: Array<{ id?: number | string; name?: string; enabled?: boolean; [key: string]: unknown }>;
    };
    const autoResult = await upsertImportedAutomations(sheetId, data.data ?? []);
    automationsAdded = autoResult.added;
    automationsSkipped = autoResult.skipped;
  } catch {
    // Automations require Business/Enterprise; skip quietly.
  }

  const extras = await importSheetAttachmentsAndDiscussions(
    sheetId,
    rows.map((row) => row.id),
  );

  return {
    rowsAdded: sheetResult.rowsAdded,
    rowsSkipped: sheetResult.rowsSkipped,
    automationsAdded,
    automationsSkipped,
    attachmentsAdded: extras.attachmentsAdded,
    discussionsAdded: extras.discussionsAdded,
  };
}

/** Fetch a sheet from Smartsheet without going through the imported-store short-circuit. */
async function fetchLiveSheet(sheetId: number): Promise<Record<string, unknown>> {
  const sheet = (await liveApi(`/sheets/${sheetId}`)) as Record<string, unknown>;

  const pageSize = 5000;
  const rows: unknown[] = [...((sheet.rows as unknown[]) ?? [])];
  const reportedTotal = Math.max((sheet.totalRowCount as number | undefined) ?? 0, rows.length);

  if (reportedTotal > rows.length) {
    let page = rows.length > 0 ? 2 : 1;
    while (rows.length < reportedTotal) {
      const next = (await liveApi(`/sheets/${sheetId}?page=${page}&pageSize=${pageSize}`)) as {
        rows?: unknown[];
      };
      const batch = next.rows ?? [];
      if (!batch.length) break;
      rows.push(...batch);
      if (batch.length < pageSize) break;
      page += 1;
    }
  }

  sheet.rows = rows;
  sheet.totalRowCount = Math.max(reportedTotal, rows.length);
  return sheet;
}

async function fetchLiveReport(reportId: number): Promise<Record<string, unknown>> {
  return (await liveApi(`/reports/${reportId}`)) as Record<string, unknown>;
}

async function importOneReport(reportId: number, nameHint?: string): Promise<{
  rowsAdded: number;
  rowsSkipped: number;
}> {
  const report = await fetchLiveReport(reportId);
  const rows = ((report.rows as Array<Record<string, unknown>>) ?? []).map((row) => ({
    id: Number(row.id),
    sheetId: typeof row.sheetId === "number" ? row.sheetId : null,
    cells: cellsFromApi(row.cells),
  }));

  return upsertImportedReport({
    reportId: Number(report.id ?? reportId),
    name: String(report.name ?? nameHint ?? `Report ${reportId}`),
    columns: (report.columns as unknown[]) ?? [],
    rows,
  });
}

async function resolveImportTargets(scope: ImportScope): Promise<{
  sheets: Array<{ id: number; name: string }>;
  reports: Array<{ id: number; name: string }>;
}> {
  if (scope === "registered") {
    const sources = await listSourceConfigs();
    const sheets = sources
      .filter((source) => source.sourceType === "sheet")
      .map((source) => ({ id: source.smartsheetId, name: source.label }));
    const reports = sources
      .filter((source) => source.sourceType === "report")
      .map((source) => ({ id: source.smartsheetId, name: source.label }));
    return { sheets, reports };
  }

  const [sheets, reports] = await Promise.all([
    listSmartsheetCatalog("sheet"),
    listSmartsheetCatalog("report"),
  ]);
  return { sheets, reports };
}

export async function importSmartsheetData(scope: ImportScope = "registered"): Promise<ImportSummary> {
  if (!sheetsDbEnabled()) {
    throw new Error("DATABASE_URL is required to import Smartsheet data.");
  }
  if (!(await isSmartsheetApiEnabled())) {
    throw new Error("Turn the Smartsheet API on before importing.");
  }

  const summary: ImportSummary = {
    scope,
    sheetsProcessed: 0,
    reportsProcessed: 0,
    rowsAdded: 0,
    rowsSkipped: 0,
    automationsAdded: 0,
    automationsSkipped: 0,
    attachmentsAdded: 0,
    discussionsAdded: 0,
    errors: [],
  };

  const { sheets, reports } = await resolveImportTargets(scope);

  if (scope === "registered" && sheets.length === 0 && reports.length === 0) {
    summary.errors.push("No registered sources found. Register sources first, or choose Import all.");
    return summary;
  }

  for (const item of sheets) {
    try {
      const result = await importOneSheet(item.id, item.name);
      summary.sheetsProcessed += 1;
      summary.rowsAdded += result.rowsAdded;
      summary.rowsSkipped += result.rowsSkipped;
      summary.automationsAdded += result.automationsAdded;
      summary.automationsSkipped += result.automationsSkipped;
      summary.attachmentsAdded += result.attachmentsAdded;
      summary.discussionsAdded += result.discussionsAdded;
    } catch (error) {
      summary.errors.push(
        `Sheet ${item.name} (${item.id}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  for (const item of reports) {
    try {
      const result = await importOneReport(item.id, item.name);
      summary.reportsProcessed += 1;
      summary.rowsAdded += result.rowsAdded;
      summary.rowsSkipped += result.rowsSkipped;
    } catch (error) {
      summary.errors.push(
        `Report ${item.name} (${item.id}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return summary;
}

/** @deprecated Prefer `importSmartsheetData("all")`. */
export async function importAllSmartsheetData(): Promise<ImportSummary> {
  return importSmartsheetData("all");
}
