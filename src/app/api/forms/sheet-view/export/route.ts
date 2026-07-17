import { csvResponse, rowsToCsv } from "@/lib/export-csv";
import { requireFormsAccess } from "@/lib/forms/forms-api";
import { ensureBootstrapped } from "@/lib/forms/init";
import * as registry from "@/lib/forms/registry";
import * as ss from "@/lib/forms/smartsheet-api";

export const dynamic = "force-dynamic";

/** CSV export of the active form sheet grid. */
export async function GET() {
  const access = await requireFormsAccess();
  if ("response" in access) return access.response;

  await ensureBootstrapped();
  const sheetId = await registry.activeSheetId();
  if (!sheetId) {
    return Response.json({ message: "No form selected." }, { status: 409 });
  }

  const sheet = await ss.getSheet(sheetId);
  const columns = ss.extractColumns(sheet);
  const headers = columns.map((c) => c.title);
  const rows = ((sheet.rows as Array<{ cells?: Array<{ columnId: number; displayValue?: string; value?: unknown }> }>) ?? []).map(
    (row) => {
      const byId = new Map((row.cells ?? []).map((c) => [c.columnId, c]));
      return columns.map((col) => {
        const cell = byId.get(col.id);
        if (!cell) return "";
        if (typeof cell.displayValue === "string") return cell.displayValue;
        if (cell.value == null) return "";
        return String(cell.value);
      });
    },
  );

  const name = typeof sheet.name === "string" ? sheet.name : sheetId;
  return csvResponse(`${name.replace(/[^\w.-]+/g, "_")}.csv`, rowsToCsv(headers, rows));
}
