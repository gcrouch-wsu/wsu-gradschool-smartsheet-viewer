/** Shared helpers for student row/detail APIs. */

import { buildSubmissions, type Submission } from "@/lib/forms/tracker";
import {
  filterOwnedRows,
  getAllowlistedSourceBySheetId,
  resolveStudentEmailColumnIds,
  rowHasStudentEmail,
  type FormsSheetColumn,
  type FormsSheetRow,
  type StudentAllowlistedSource,
} from "@/lib/forms/student-access";
import * as ss from "@/lib/forms/smartsheet-api";

export interface OwnedSheetContext {
  entry: StudentAllowlistedSource;
  sheet: Record<string, unknown>;
  columns: FormsSheetColumn[];
  rows: FormsSheetRow[];
  studentEmailColumnIds: number[];
  ownedRows: FormsSheetRow[];
  submissions: Submission[];
}

export async function loadOwnedSheetContext(
  sheetId: string,
  email: string,
): Promise<{ ok: true; context: OwnedSheetContext } | { ok: false; status: number; error: string }> {
  const entry = await getAllowlistedSourceBySheetId(sheetId);
  if (!entry) {
    return { ok: false, status: 403, error: "This sheet is not available in the student portal." };
  }

  const sheet = await ss.getSheet(entry.sheetId);
  const columns = (sheet.columns ?? []) as FormsSheetColumn[];
  const studentEmailColumnIds = await resolveStudentEmailColumnIds(entry.source, columns);
  if (studentEmailColumnIds.length === 0) {
    return { ok: false, status: 403, error: "This sheet has no Student Email column configured." };
  }

  const rows = (Array.isArray(sheet.rows) ? sheet.rows : []) as FormsSheetRow[];
  const ownedRows = filterOwnedRows(rows, email, studentEmailColumnIds);
  const ownedIds = new Set(ownedRows.map((r) => r.id));
  const allSubmissions = await buildSubmissions(sheet);
  const submissions = allSubmissions.filter((s) => ownedIds.has(s.rowId));

  return {
    ok: true,
    context: {
      entry,
      sheet,
      columns,
      rows,
      studentEmailColumnIds,
      ownedRows,
      submissions,
    },
  };
}

export function assertOwnedRow(
  context: OwnedSheetContext,
  rowId: number,
  email: string,
): FormsSheetRow | null {
  const row = context.rows.find((r) => r.id === rowId);
  if (!row) return null;
  if (!rowHasStudentEmail(row, email, context.studentEmailColumnIds)) return null;
  return row;
}

export function serializeRowCells(row: FormsSheetRow, columns: FormsSheetColumn[]) {
  const byId = new Map(columns.map((c) => [c.id, c]));
  return (row.cells ?? []).map((cell) => {
    const col = byId.get(cell.columnId);
    return {
      columnId: cell.columnId,
      title: col?.title ?? `Column ${cell.columnId}`,
      type: col?.type,
      displayValue: String(cell.displayValue ?? cell.value ?? "").trim(),
      value: cell.value,
    };
  });
}
