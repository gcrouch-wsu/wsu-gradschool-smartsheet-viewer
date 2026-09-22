import * as ss from "@/lib/forms/smartsheet-api";
import { queryFormsDb } from "@/lib/forms/db";
import { includedFields, mergeTemplate, primaryFieldValue, type MergeField } from "@/lib/workflows/merge";
import type { UserNotification } from "@/lib/workflows/notifications";
import type { NotificationPayload } from "@/lib/workflows/types";

type Cell = { columnId: number; value?: unknown; displayValue?: unknown; objectValue?: unknown };

export interface ColumnIndex {
  titles: Map<number, string>;
  idByTitle: Map<string, number>;
  primaryTitle: string | null;
}

const columnCache = new Map<string, { at: number; index: ColumnIndex }>();

/** Prefer a person's name over an email when labeling a cell in an alert. */
export function cellLabel(cell: Cell | undefined): string {
  if (!cell) return "";
  const objects = [cell.objectValue, cell.value].filter((entry) => entry && typeof entry === "object") as Array<{
    name?: unknown;
    email?: unknown;
    values?: unknown[];
  }>;
  for (const obj of objects) {
    if (Array.isArray(obj.values)) {
      const names = obj.values
        .map((entry) => (entry && typeof entry === "object" ? String((entry as { name?: unknown }).name ?? "").trim() : ""))
        .filter(Boolean);
      if (names.length) return names.join(", ");
    }
    if (typeof obj.name === "string" && obj.name.trim()) return obj.name.trim();
  }
  const display = cell.displayValue != null ? String(cell.displayValue).trim() : "";
  if (display) {
    const before = display.split("<")[0]?.replace(/"/g, "").trim() ?? "";
    if (before && display.includes("@") && !before.includes("@")) return before;
    return display;
  }
  if (cell.value === true) return "Yes";
  if (cell.value === false) return "No";
  if (cell.value == null || typeof cell.value === "object") return "";
  return String(cell.value);
}

export function columnIndexFromList(columns: Array<{ id: number; title?: string; primary?: boolean }>): ColumnIndex {
  const titles = new Map<number, string>();
  const idByTitle = new Map<string, number>();
  let primaryTitle: string | null = null;
  for (const column of columns) {
    const title = String(column.title ?? "");
    titles.set(column.id, title);
    if (title) idByTitle.set(title, column.id);
    if (column.primary && title) primaryTitle = title;
  }
  if (!primaryTitle && columns[0]?.title) primaryTitle = String(columns[0].title);
  return { titles, idByTitle, primaryTitle };
}

export async function loadColumnIndex(sheetId: number): Promise<ColumnIndex> {
  const key = String(sheetId);
  const cached = columnCache.get(key);
  if (cached && Date.now() - cached.at < 60_000) return cached.index;
  const columns = (await ss.listColumns(sheetId)) as Array<{ id: number; title?: string; primary?: boolean }>;
  const index = columnIndexFromList(columns);
  columnCache.set(key, { at: Date.now(), index });
  return index;
}

export function fieldsFromCells(columns: ColumnIndex, cells: Cell[]): MergeField[] {
  return cells.map((cell) => ({
    title: columns.titles.get(cell.columnId) ?? `Column ${cell.columnId}`,
    value: cellLabel(cell),
  }));
}

export function renderAlertCopy(input: {
  titleTemplate: string;
  bodyTemplate: string;
  fallbackTitle: string;
  fields: MergeField[];
  primaryTitle: string | null;
  includeColumnIds?: number[];
  idByTitle: Map<string, number>;
}): { title: string; body: string; fields: MergeField[] } {
  const primary = primaryFieldValue(input.fields, input.primaryTitle);
  const extras = { Primary: primary || "this row" };
  const title = mergeTemplate(input.titleTemplate, input.fields, extras).trim() || input.fallbackTitle;
  const body = mergeTemplate(input.bodyTemplate, input.fields, extras).trim();
  return {
    title,
    body,
    fields: includedFields(input.fields, input.includeColumnIds ?? [], input.idByTitle),
  };
}

export async function loadAlertRow(
  sheetId: string,
  rowId: number | null,
): Promise<{ rowId: number | null; columns: ColumnIndex; cells: Cell[] } | null> {
  const numericId = Number(sheetId);
  if (!Number.isFinite(numericId) || numericId <= 0) return null;
  if (rowId && rowId > 0) {
    const columns = await loadColumnIndex(numericId);
    const raw = (await ss.getRow(numericId, rowId)) as { id?: number; cells?: Cell[] };
    return { rowId: raw.id ?? rowId, columns, cells: raw.cells ?? [] };
  }
  const head = await ss.getSheetHead(numericId);
  const columns = columnIndexFromList(head.columns);
  columnCache.set(String(numericId), { at: Date.now(), index: columns });
  if (!head.row) return { rowId: null, columns, cells: [] };
  return { rowId: head.row.id, columns, cells: head.row.cells ?? [] };
}

function stillHasToken(value: string): boolean {
  return /\{\{[^}]+\}\}/.test(value);
}

/** Rewrite saved alerts that still contain {{Primary}} using the row's primary column. */
export async function refreshPlaceholderNotifications(items: UserNotification[]): Promise<UserNotification[]> {
  const needs = items.filter((item) => stillHasToken(item.title) || stillHasToken(item.body));
  if (!needs.length) return items;
  const cache = new Map<string, Awaited<ReturnType<typeof loadAlertRow>>>();
  const next = new Map<string, UserNotification>();

  for (const item of needs) {
    const sheetId = item.payload.sheetId;
    if (!sheetId) continue;
    const cacheKey = `${sheetId}:${item.payload.rowId ?? "head"}`;
    if (!cache.has(cacheKey)) {
      try {
        cache.set(cacheKey, await loadAlertRow(sheetId, item.payload.rowId));
      } catch {
        cache.set(cacheKey, null);
      }
    }
    const loaded = cache.get(cacheKey);
    if (!loaded) continue;
    const fields = fieldsFromCells(loaded.columns, loaded.cells);
    const rendered = renderAlertCopy({
      titleTemplate: item.title,
      bodyTemplate: item.body,
      fallbackTitle: item.title,
      fields,
      primaryTitle: loaded.columns.primaryTitle,
      idByTitle: loaded.columns.idByTitle,
    });
    if (stillHasToken(rendered.title) || rendered.title === item.title) continue;
    const payload: NotificationPayload = {
      ...item.payload,
      rowId: item.payload.rowId ?? loaded.rowId,
      fields: item.payload.fields.length ? item.payload.fields : rendered.fields,
    };
    await queryFormsDb(
      `UPDATE user_notifications SET title = $1, body = $2, payload = $3 WHERE id = $4`,
      [rendered.title, rendered.body, JSON.stringify(payload), item.id],
    );
    next.set(item.id, { ...item, title: rendered.title, body: rendered.body, payload });
  }

  if (!next.size) return items;
  return items.map((item) => next.get(item.id) ?? item);
}
