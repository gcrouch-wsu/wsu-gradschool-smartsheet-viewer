import type { SmartsheetColumn, SmartsheetDataset, SmartsheetRow, SourceType } from "@/lib/config/types";
import { normalizeColumnKey } from "@/lib/smartsheet-column-key";
import { querySheetsDb, sheetsDbEnabled } from "@/lib/local-sheets/db";
import {
  coerceResourceId,
  newLocalUuid,
  normalizeResourceId,
  parseResourceId,
  resourceIdsEqual,
  type ResourceId,
} from "@/lib/local-sheets/ids";
import type { RowOrigin, SheetCellJson, SheetColumnJson, SheetRowJson } from "@/lib/local-sheets/types";

async function assertUniqueSheetName(name: string, exceptSheetId?: ResourceId): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw Object.assign(new Error("Sheet name is required."), { status: 400 });
  }
  const { rows } = await querySheetsDb<{ sheet_id: string; name: string }>(
    `SELECT sheet_id, name FROM sheets WHERE lower(trim(name)) = lower(trim($1)) LIMIT 1`,
    [trimmed],
  );
  const hit = rows[0];
  if (hit && (!exceptSheetId || !resourceIdsEqual(hit.sheet_id, exceptSheetId))) {
    throw Object.assign(new Error(`A sheet named "${hit.name}" already exists. Choose a different name.`), {
      status: 409,
    });
  }
}

async function uniqueImportedSheetName(name: string, sheetId: ResourceId): Promise<string> {
  const trimmed = name.trim() || `Sheet ${sheetId}`;
  const { rows } = await querySheetsDb<{ sheet_id: string }>(
    `SELECT sheet_id FROM sheets WHERE lower(trim(name)) = lower(trim($1)) AND sheet_id <> $2 LIMIT 1`,
    [trimmed, normalizeResourceId(sheetId)],
  );
  if (!rows.length) return trimmed;
  return `${trimmed} (${sheetId})`;
}

export async function hasImportedSheet(sheetId: string | number): Promise<boolean> {
  if (!sheetsDbEnabled()) return false;
  const id = parseResourceId(sheetId);
  if (id === undefined) return false;
  const { rows } = await querySheetsDb<{ sheet_id: string }>(
    `SELECT sheet_id FROM sheets WHERE sheet_id = $1 LIMIT 1`,
    [normalizeResourceId(id)],
  );
  return rows.length > 0;
}

export async function hasImportedReport(reportId: string | number): Promise<boolean> {
  if (!sheetsDbEnabled()) return false;
  const id = parseResourceId(reportId);
  if (id === undefined) return false;
  const { rows } = await querySheetsDb<{ report_id: string }>(
    `SELECT report_id FROM reports WHERE report_id = $1 LIMIT 1`,
    [normalizeResourceId(id)],
  );
  return rows.length > 0;
}

function columnsFromJson(columns: unknown): SheetColumnJson[] {
  return Array.isArray(columns) ? (columns as SheetColumnJson[]) : [];
}

function cellsFromJson(cells: unknown): SheetCellJson[] {
  return Array.isArray(cells) ? (cells as SheetCellJson[]) : [];
}

function toViewerColumns(columns: SheetColumnJson[]): SmartsheetColumn[] {
  return columns.map((column, index) => ({
    id: Number(column.id),
    index: typeof column.index === "number" ? column.index : index,
    title: String(column.title ?? ""),
    type: String(column.type ?? column.columnType ?? "TEXT_NUMBER"),
    options: Array.isArray(column.options) ? column.options.map(String) : undefined,
    locked: Boolean(column.locked),
  }));
}

function toViewerRows(rows: SheetRowJson[], columns: SmartsheetColumn[]): SmartsheetRow[] {
  const columnsById = new Map(columns.map((column) => [column.id, column]));
  return rows.map((row) => {
    const cellsById: SmartsheetRow["cellsById"] = {};
    const cellsByTitle: SmartsheetRow["cellsByTitle"] = {};
    for (const cell of row.cells ?? []) {
      const column = columnsById.get(cell.columnId);
      if (!column) continue;
      const normalized = {
        columnId: column.id,
        columnTitle: column.title,
        columnType: column.type,
        value: cell.value,
        displayValue: cell.displayValue,
        objectValue: cell.objectValue,
        hyperlink: cell.hyperlink ?? undefined,
      };
      cellsById[column.id] = normalized;
      cellsByTitle[normalizeColumnKey(column.title)] = normalized;
    }
    return {
      id: row.id,
      sheetId: row.sheetId,
      cellsById,
      cellsByTitle,
    };
  });
}

export async function getImportedSheet(sheetId: string | number): Promise<Record<string, unknown> | null> {
  if (!sheetsDbEnabled()) return null;
  const parsed = parseResourceId(sheetId);
  if (parsed === undefined) return null;
  const id = normalizeResourceId(parsed);
  const { rows: sheetRows } = await querySheetsDb<{
    sheet_id: string;
    name: string;
    columns: unknown;
    total_row_count: number;
  }>(`SELECT sheet_id, name, columns, total_row_count FROM sheets WHERE sheet_id = $1`, [id]);
  const sheet = sheetRows[0];
  if (!sheet) return null;

  const sheetKey = coerceResourceId(sheet.sheet_id);
  const { rows: dataRows } = await querySheetsDb<{
    row_id: string;
    row_number: number | null;
    cells: unknown;
    created_at: string | null;
    modified_at: string | null;
  }>(
    `SELECT row_id, row_number, cells, created_at, modified_at
     FROM rows WHERE sheet_id = $1
     ORDER BY COALESCE(row_number, 0), row_id`,
    [id],
  );

  const rows = dataRows.map((row) => ({
    id: coerceResourceId(row.row_id),
    sheetId: sheetKey,
    rowNumber: row.row_number ?? undefined,
    createdAt: row.created_at ?? undefined,
    modifiedAt: row.modified_at ?? undefined,
    cells: cellsFromJson(row.cells),
  }));

  return {
    id: sheetKey,
    name: sheet.name,
    columns: columnsFromJson(sheet.columns),
    rows,
    totalRowCount: Math.max(sheet.total_row_count, rows.length),
  };
}

export async function getImportedReport(reportId: string | number): Promise<Record<string, unknown> | null> {
  if (!sheetsDbEnabled()) return null;
  const parsed = parseResourceId(reportId);
  if (parsed === undefined) return null;
  const id = normalizeResourceId(parsed);
  const { rows: reportRows } = await querySheetsDb<{
    report_id: string;
    name: string;
    columns: unknown;
  }>(`SELECT report_id, name, columns FROM reports WHERE report_id = $1`, [id]);
  const report = reportRows[0];
  if (!report) return null;

  const reportKey = coerceResourceId(report.report_id);
  const { rows: dataRows } = await querySheetsDb<{
    row_id: string;
    sheet_id: string | null;
    cells: unknown;
  }>(`SELECT row_id, sheet_id, cells FROM report_rows WHERE report_id = $1 ORDER BY row_id`, [id]);

  return {
    id: reportKey,
    name: report.name,
    columns: columnsFromJson(report.columns),
    rows: dataRows.map((row) => ({
      id: coerceResourceId(row.row_id),
      sheetId: row.sheet_id != null ? coerceResourceId(row.sheet_id) : undefined,
      cells: cellsFromJson(row.cells),
    })),
    totalRowCount: dataRows.length,
  };
}

export async function getImportedDataset(
  sourceType: SourceType,
  smartsheetId: string | number,
): Promise<SmartsheetDataset | null> {
  const raw =
    sourceType === "report"
      ? await getImportedReport(smartsheetId)
      : await getImportedSheet(smartsheetId);
  if (!raw) return null;

  const columns = toViewerColumns(columnsFromJson(raw.columns));
  const rows = toViewerRows((raw.rows as SheetRowJson[]) ?? [], columns);
  return {
    sourceType,
    id: Number(raw.id),
    name: String(raw.name ?? ""),
    columns,
    rows,
    fetchedAt: new Date().toISOString(),
  };
}

export async function upsertImportedSheet(input: {
  sheetId: number;
  name: string;
  columns: unknown[];
  rows: Array<{
    id: number;
    rowNumber?: number | null;
    createdAt?: string | null;
    modifiedAt?: string | null;
    cells?: SheetCellJson[];
  }>;
}): Promise<{ rowsAdded: number; rowsSkipped: number }> {
  const sheetKey = normalizeResourceId(input.sheetId);
  const sheetName = await uniqueImportedSheetName(input.name, input.sheetId);
  await querySheetsDb(
    `INSERT INTO sheets (sheet_id, name, columns, total_row_count, imported_at, updated_at)
     VALUES ($1, $2, $3::jsonb, $4, now(), now())
     ON CONFLICT (sheet_id) DO UPDATE SET
       name = EXCLUDED.name,
       columns = EXCLUDED.columns,
       total_row_count = GREATEST(sheets.total_row_count, EXCLUDED.total_row_count),
       updated_at = now()`,
    [sheetKey, sheetName, JSON.stringify(input.columns), input.rows.length],
  );

  let rowsAdded = 0;
  let rowsSkipped = 0;
  for (const row of input.rows) {
    const { rowCount } = await querySheetsDb(
      `INSERT INTO rows (sheet_id, row_id, row_number, cells, origin, created_at, modified_at, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, 'import', $5, $6, now())
       ON CONFLICT (sheet_id, row_id) DO NOTHING`,
      [
        sheetKey,
        normalizeResourceId(row.id),
        row.rowNumber ?? null,
        JSON.stringify(row.cells ?? []),
        row.createdAt ?? null,
        row.modifiedAt ?? null,
      ],
    );
    if (rowCount > 0) rowsAdded += 1;
    else rowsSkipped += 1;
  }

  await querySheetsDb(
    `UPDATE sheets SET total_row_count = (SELECT COUNT(*) FROM rows WHERE sheet_id = $1), updated_at = now()
     WHERE sheet_id = $1`,
    [sheetKey],
  );

  return { rowsAdded, rowsSkipped };
}

export async function upsertImportedReport(input: {
  reportId: number;
  name: string;
  columns: unknown[];
  rows: Array<{ id: number; sheetId?: number | null; cells?: SheetCellJson[] }>;
}): Promise<{ rowsAdded: number; rowsSkipped: number }> {
  await querySheetsDb(
    `INSERT INTO reports (report_id, name, columns, imported_at, updated_at)
     VALUES ($1, $2, $3::jsonb, now(), now())
     ON CONFLICT (report_id) DO UPDATE SET
       name = EXCLUDED.name,
       columns = EXCLUDED.columns,
       updated_at = now()`,
    [input.reportId, input.name, JSON.stringify(input.columns)],
  );

  let rowsAdded = 0;
  let rowsSkipped = 0;
  for (const row of input.rows) {
    const { rowCount } = await querySheetsDb(
      `INSERT INTO report_rows (report_id, row_id, sheet_id, cells, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, now())
       ON CONFLICT (report_id, row_id) DO NOTHING`,
      [input.reportId, row.id, row.sheetId ?? null, JSON.stringify(row.cells ?? [])],
    );
    if (rowCount > 0) rowsAdded += 1;
    else rowsSkipped += 1;
  }
  return { rowsAdded, rowsSkipped };
}

export async function upsertImportedAutomations(
  sheetId: number,
  rules: Array<{ id?: number | string; name?: string; enabled?: boolean; [key: string]: unknown }>,
): Promise<{ added: number; skipped: number }> {
  let added = 0;
  let skipped = 0;
  for (const rule of rules) {
    if (rule.id == null) {
      skipped += 1;
      continue;
    }
    const ruleId = Number(rule.id);
    if (!Number.isFinite(ruleId)) {
      skipped += 1;
      continue;
    }
    const { rowCount } = await querySheetsDb(
      `INSERT INTO sheet_automations (sheet_id, rule_id, name, enabled, definition, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, now())
       ON CONFLICT (sheet_id, rule_id) DO NOTHING`,
      [sheetId, ruleId, rule.name ?? null, rule.enabled !== false, JSON.stringify(rule)],
    );
    if (rowCount > 0) added += 1;
    else skipped += 1;
  }
  return { added, skipped };
}

export async function listImportedAutomations(sheetId: string | number): Promise<unknown[]> {
  const id = normalizeResourceId(sheetId);
  const { rows } = await querySheetsDb<{
    rule_id: string;
    name: string | null;
    enabled: boolean;
    definition: Record<string, unknown>;
  }>(
    `SELECT rule_id, name, enabled, definition FROM sheet_automations WHERE sheet_id = $1 ORDER BY rule_id`,
    [id],
  );
  return rows.map((row) => ({
    ...(row.definition ?? {}),
    id: Number(row.rule_id),
    name: row.name ?? (row.definition as { name?: string })?.name,
    enabled: row.enabled,
  }));
}

export async function setImportedAutomationEnabled(
  sheetId: string | number,
  ruleId: string | number,
  enabled: boolean,
): Promise<unknown | null> {
  const { rows } = await querySheetsDb<{
    rule_id: string;
    name: string | null;
    enabled: boolean;
    definition: Record<string, unknown>;
  }>(
    `UPDATE sheet_automations
     SET enabled = $3, updated_at = now()
     WHERE sheet_id = $1 AND rule_id = $2
     RETURNING rule_id, name, enabled, definition`,
    [normalizeResourceId(sheetId), Number(ruleId), enabled],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    ...(row.definition ?? {}),
    id: Number(row.rule_id),
    name: row.name,
    enabled: row.enabled,
  };
}

export async function upsertImportedAttachments(
  sheetId: number,
  attachments: Array<{
    id: number;
    rowId?: number | null;
    name: string;
    mimeType?: string | null;
    sizeBytes?: number | null;
    content?: Buffer | null;
    url?: string | null;
    meta?: Record<string, unknown>;
  }>,
): Promise<{ added: number; skipped: number }> {
  let added = 0;
  let skipped = 0;
  for (const attachment of attachments) {
    const { rowCount } = await querySheetsDb(
      `INSERT INTO attachments (sheet_id, attachment_id, row_id, name, mime_type, size_bytes, content, url, meta, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, now())
       ON CONFLICT (sheet_id, attachment_id) DO NOTHING`,
      [
        sheetId,
        attachment.id,
        attachment.rowId ?? null,
        attachment.name,
        attachment.mimeType ?? null,
        attachment.sizeBytes ?? null,
        attachment.content ?? null,
        attachment.url ?? null,
        JSON.stringify(attachment.meta ?? {}),
      ],
    );
    if (rowCount > 0) added += 1;
    else skipped += 1;
  }
  return { added, skipped };
}

export async function listImportedAttachments(
  sheetId: string | number,
  rowId?: string | number,
): Promise<unknown[]> {
  const id = normalizeResourceId(sheetId);
  if (rowId != null) {
    const { rows } = await querySheetsDb<{
      attachment_id: string;
      row_id: string | null;
      name: string;
      mime_type: string | null;
      size_bytes: number | null;
      url: string | null;
      meta: Record<string, unknown>;
    }>(
      `SELECT attachment_id, row_id, name, mime_type, size_bytes, url, meta
       FROM attachments WHERE sheet_id = $1 AND row_id = $2 ORDER BY attachment_id`,
      [id, Number(rowId)],
    );
    return rows.map((row) => ({
      id: coerceResourceId(row.attachment_id),
      parentId: row.row_id != null ? coerceResourceId(row.row_id) : undefined,
      name: row.name,
      mimeType: row.mime_type ?? undefined,
      sizeInKb: row.size_bytes != null ? Math.round(row.size_bytes / 1024) : undefined,
      url: row.url ?? undefined,
      ...(row.meta ?? {}),
    }));
  }
  const { rows } = await querySheetsDb<{
    attachment_id: string;
    row_id: string | null;
    name: string;
    mime_type: string | null;
    size_bytes: number | null;
    url: string | null;
    meta: Record<string, unknown>;
  }>(
    `SELECT attachment_id, row_id, name, mime_type, size_bytes, url, meta
     FROM attachments WHERE sheet_id = $1 ORDER BY attachment_id`,
    [id],
  );
  return rows.map((row) => ({
    id: coerceResourceId(row.attachment_id),
    parentId: row.row_id != null ? coerceResourceId(row.row_id) : undefined,
    name: row.name,
    mimeType: row.mime_type ?? undefined,
    sizeInKb: row.size_bytes != null ? Math.round(row.size_bytes / 1024) : undefined,
    url: row.url ?? undefined,
    ...(row.meta ?? {}),
  }));
}

export async function getImportedAttachment(
  sheetId: string | number,
  attachmentId: string | number,
): Promise<Record<string, unknown> | null> {
  const { rows } = await querySheetsDb<{
    attachment_id: string;
    row_id: string | null;
    name: string;
    mime_type: string | null;
    size_bytes: number | null;
    url: string | null;
    content: Buffer | null;
    meta: Record<string, unknown>;
  }>(
    `SELECT attachment_id, row_id, name, mime_type, size_bytes, url, content, meta
     FROM attachments WHERE sheet_id = $1 AND attachment_id = $2`,
    [normalizeResourceId(sheetId), normalizeResourceId(attachmentId)],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: coerceResourceId(row.attachment_id),
    parentId: row.row_id != null ? coerceResourceId(row.row_id) : undefined,
    name: row.name,
    mimeType: row.mime_type ?? undefined,
    sizeInKb: row.size_bytes != null ? Math.round(row.size_bytes / 1024) : undefined,
    url: row.url ?? undefined,
    content: row.content ?? undefined,
    ...(row.meta ?? {}),
  };
}

export async function addImportedAttachment(
  sheetId: string | number,
  rowId: string | number,
  file: Blob,
  fileName: string,
): Promise<Record<string, unknown>> {
  const attachmentId = newLocalUuid();
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || null;
  const sheetKey = normalizeResourceId(sheetId);
  const rowKey = normalizeResourceId(rowId);
  await querySheetsDb(
    `INSERT INTO attachments (sheet_id, attachment_id, row_id, name, mime_type, size_bytes, content, meta, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, '{}'::jsonb, now())`,
    [sheetKey, attachmentId, rowKey, fileName, mimeType, buffer.length, buffer],
  );
  return {
    id: attachmentId,
    parentId: coerceResourceId(rowKey),
    name: fileName,
    mimeType: mimeType ?? undefined,
    sizeInKb: Math.round(buffer.length / 1024),
  };
}

export async function upsertImportedDiscussions(
  sheetId: number,
  discussions: Array<{
    id: number;
    rowId: number;
    title?: string | null;
    comments?: unknown[];
    meta?: Record<string, unknown>;
  }>,
): Promise<{ added: number; skipped: number }> {
  let added = 0;
  let skipped = 0;
  for (const discussion of discussions) {
    const { rowCount } = await querySheetsDb(
      `INSERT INTO discussions (sheet_id, discussion_id, row_id, title, comments, meta, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, now())
       ON CONFLICT (sheet_id, discussion_id) DO NOTHING`,
      [
        sheetId,
        discussion.id,
        discussion.rowId,
        discussion.title ?? null,
        JSON.stringify(discussion.comments ?? []),
        JSON.stringify(discussion.meta ?? {}),
      ],
    );
    if (rowCount > 0) added += 1;
    else skipped += 1;
  }
  return { added, skipped };
}

export async function listImportedDiscussions(
  sheetId: string | number,
  rowId: string | number,
): Promise<unknown[]> {
  const { rows } = await querySheetsDb<{
    discussion_id: string;
    row_id: string;
    title: string | null;
    comments: unknown;
    meta: Record<string, unknown>;
  }>(
    `SELECT discussion_id, row_id, title, comments, meta
     FROM discussions WHERE sheet_id = $1 AND row_id = $2 ORDER BY discussion_id`,
    [normalizeResourceId(sheetId), normalizeResourceId(rowId)],
  );
  return rows.map((row) => ({
    id: coerceResourceId(row.discussion_id),
    title: row.title ?? undefined,
    comments: Array.isArray(row.comments) ? row.comments : [],
    ...(row.meta ?? {}),
  }));
}

export async function addImportedDiscussion(
  sheetId: string | number,
  rowId: string | number,
  text: string,
): Promise<Record<string, unknown>> {
  const discussionId = newLocalUuid();
  const comments = [
    {
      id: discussionId,
      text,
      createdAt: new Date().toISOString(),
    },
  ];
  await querySheetsDb(
    `INSERT INTO discussions (sheet_id, discussion_id, row_id, title, comments, meta, updated_at)
     VALUES ($1, $2, $3, NULL, $4::jsonb, '{}'::jsonb, now())`,
    [normalizeResourceId(sheetId), discussionId, normalizeResourceId(rowId), JSON.stringify(comments)],
  );
  return { id: discussionId, comments };
}

function mergeCells(
  existing: SheetCellJson[],
  updates: Array<{ columnId: number; value?: unknown; objectValue?: unknown }>,
): SheetCellJson[] {
  const byId = new Map(existing.map((cell) => [cell.columnId, { ...cell }]));
  for (const update of updates) {
    const prev = byId.get(update.columnId) ?? { columnId: update.columnId };
    const next: SheetCellJson = { ...prev, columnId: update.columnId };
    if ("objectValue" in update && update.objectValue !== undefined) {
      next.objectValue = update.objectValue;
      delete next.value;
      next.displayValue = undefined;
    } else if ("value" in update) {
      next.value = update.value;
      next.displayValue =
        update.value === null || update.value === undefined
          ? ""
          : typeof update.value === "string"
            ? update.value
            : String(update.value);
      delete next.objectValue;
    }
    byId.set(update.columnId, next);
  }
  return [...byId.values()];
}

export async function updateImportedRows(
  sheetId: string | number,
  rows: Array<{
    id: ResourceId;
    cells: Array<{ columnId: number; value?: unknown; objectValue?: unknown }>;
  }>,
): Promise<unknown> {
  const id = normalizeResourceId(sheetId);
  const now = new Date().toISOString();
  for (const row of rows) {
    const rowKey = normalizeResourceId(row.id);
    const { rows: existing } = await querySheetsDb<{ cells: unknown }>(
      `SELECT cells FROM rows WHERE sheet_id = $1 AND row_id = $2`,
      [id, rowKey],
    );
    if (!existing[0]) {
      throw new Error(`Row ${row.id} was not found on imported sheet ${id}.`);
    }
    const merged = mergeCells(cellsFromJson(existing[0].cells), row.cells);
    await querySheetsDb(
      `UPDATE rows SET cells = $3::jsonb, modified_at = $4, updated_at = now()
       WHERE sheet_id = $1 AND row_id = $2`,
      [id, rowKey, JSON.stringify(merged), now],
    );
  }
  return { resultCode: 0, message: "SUCCESS", result: rows.map((row) => ({ id: row.id })) };
}

export async function addImportedRows(
  sheetId: string | number,
  rows: Array<{ cells: SheetCellJson[] }>,
  origin: RowOrigin = "local",
): Promise<unknown[]> {
  const id = normalizeResourceId(sheetId);
  const created: unknown[] = [];
  const now = new Date().toISOString();
  for (const row of rows) {
    const rowId = newLocalUuid();
    await querySheetsDb(
      `INSERT INTO rows (sheet_id, row_id, row_number, cells, origin, created_at, modified_at, updated_at)
       VALUES ($1, $2, NULL, $3::jsonb, $4, $5, $5, now())`,
      [id, rowId, JSON.stringify(row.cells ?? []), origin, now],
    );
    created.push({ id: rowId, sheetId: coerceResourceId(id), cells: row.cells ?? [] });
  }
  await querySheetsDb(
    `UPDATE sheets SET total_row_count = (SELECT COUNT(*) FROM rows WHERE sheet_id = $1), updated_at = now()
     WHERE sheet_id = $1`,
    [id],
  );
  return created;
}

export async function deleteImportedRows(
  sheetId: string | number,
  rowIds: Array<string | number>,
): Promise<unknown> {
  const id = normalizeResourceId(sheetId);
  const ids = rowIds.map((rowId) => normalizeResourceId(rowId)).filter(Boolean);
  if (ids.length) {
    await querySheetsDb(`DELETE FROM rows WHERE sheet_id = $1 AND row_id = ANY($2::text[])`, [
      id,
      ids,
    ]);
  }
  await querySheetsDb(
    `UPDATE sheets SET total_row_count = (SELECT COUNT(*) FROM rows WHERE sheet_id = $1), updated_at = now()
     WHERE sheet_id = $1`,
    [id],
  );
  return { resultCode: 0, message: "SUCCESS" };
}

export async function getImportedRow(
  sheetId: string | number,
  rowId: string | number,
): Promise<Record<string, unknown> | null> {
  const { rows } = await querySheetsDb<{
    row_id: string;
    sheet_id: string;
    cells: unknown;
    created_at: string | null;
    modified_at: string | null;
    row_number: number | null;
  }>(
    `SELECT row_id, sheet_id, cells, created_at, modified_at, row_number
     FROM rows WHERE sheet_id = $1 AND row_id = $2`,
    [normalizeResourceId(sheetId), normalizeResourceId(rowId)],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: coerceResourceId(row.row_id),
    sheetId: coerceResourceId(row.sheet_id),
    rowNumber: row.row_number ?? undefined,
    createdAt: row.created_at ?? undefined,
    modifiedAt: row.modified_at ?? undefined,
    cells: cellsFromJson(row.cells),
  };
}

export async function createImportedSheet(
  name: string,
  columns: Array<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  const trimmedName = name.trim();
  await assertUniqueSheetName(trimmedName);
  const sheetId = newLocalUuid();
  const normalizedColumns = columns.map((column, index) => ({
    ...column,
    id: typeof column.id === "number" ? column.id : -(index + 1),
    index: typeof column.index === "number" ? column.index : index,
  }));
  await querySheetsDb(
    `INSERT INTO sheets (sheet_id, name, columns, total_row_count, imported_at, updated_at)
     VALUES ($1, $2, $3::jsonb, 0, now(), now())`,
    [sheetId, trimmedName, JSON.stringify(normalizedColumns)],
  );
  return { id: sheetId, name: trimmedName, columns: normalizedColumns, rows: [], totalRowCount: 0 };
}

export async function copyImportedSheet(
  templateId: string | number,
  newName: string,
): Promise<Record<string, unknown>> {
  const source = await getImportedSheet(templateId);
  if (!source) {
    throw new Error(`Imported sheet ${templateId} was not found.`);
  }
  const trimmedName = newName.trim();
  await assertUniqueSheetName(trimmedName);
  const sheetId = newLocalUuid();
  const columns = columnsFromJson(source.columns).map((column, index) => ({
    ...column,
    id: typeof column.id === "number" ? column.id : -(index + 1),
  }));
  await querySheetsDb(
    `INSERT INTO sheets (sheet_id, name, columns, total_row_count, imported_at, updated_at)
     VALUES ($1, $2, $3::jsonb, 0, now(), now())`,
    [sheetId, trimmedName, JSON.stringify(columns)],
  );
  return { id: sheetId, name: trimmedName, columns, rows: [], totalRowCount: 0 };
}

export async function listImportedSheetSummaries(): Promise<Array<{ id: ResourceId; name: string }>> {
  if (!sheetsDbEnabled()) return [];
  const { rows } = await querySheetsDb<{ sheet_id: string; name: string }>(
    `SELECT sheet_id, name FROM sheets ORDER BY name`,
  );
  return rows.map((row) => ({ id: coerceResourceId(row.sheet_id), name: row.name }));
}

export async function listImportedReportSummaries(): Promise<Array<{ id: ResourceId; name: string }>> {
  if (!sheetsDbEnabled()) return [];
  const { rows } = await querySheetsDb<{ report_id: string; name: string }>(
    `SELECT report_id, name FROM reports ORDER BY name`,
  );
  return rows.map((row) => ({ id: coerceResourceId(row.report_id), name: row.name }));
}

export async function listImportedColumns(sheetId: string | number): Promise<unknown[]> {
  const sheet = await getImportedSheet(sheetId);
  return columnsFromJson(sheet?.columns);
}

export async function getImportedSheetHead(sheetId: string | number): Promise<{
  columns: Array<{ id: number; title?: string; primary?: boolean }>;
  row: {
    id: ResourceId;
    cells?: Array<{ columnId: number; value?: unknown; displayValue?: unknown; objectValue?: unknown }>;
  } | null;
}> {
  const sheet = await getImportedSheet(sheetId);
  const columns = columnsFromJson(sheet?.columns).map((column) => ({
    id: Number(column.id),
    title: column.title,
    primary: column.primary,
  }));
  const first = ((sheet?.rows as SheetRowJson[]) ?? [])[0] ?? null;
  return {
    columns,
    row: first
      ? {
          id: first.id,
          cells: first.cells,
        }
      : null,
  };
}

/** Fire in-app workflows for local row changes (no Smartsheet webhooks). */
export async function emitLocalRowEvents(
  sheetId: string | number,
  events: Array<{
    eventType: string;
    objectId: ResourceId;
    rowId?: ResourceId;
    columnId?: number;
  }>,
): Promise<void> {
  try {
    const { evaluateWebhookEvents } = await import("@/lib/workflows/engine");
    const sheetKey = coerceResourceId(sheetId);
    await evaluateWebhookEvents(
      events.map((event) => ({
        sheetId: sheetKey,
        eventType: event.eventType,
        objectType: "row",
        objectId: event.objectId,
        rowId: event.rowId ?? event.objectId,
        columnId: event.columnId,
        timestamp: new Date().toISOString(),
      })),
    );
  } catch {
    // Workflow failures must not block sheet writes.
  }
}
