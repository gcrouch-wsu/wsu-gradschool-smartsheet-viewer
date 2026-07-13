import { resolveFormColumns } from "@/lib/forms/form-fields";
import { resolveWorkflow } from "@/lib/forms/workflow";

export interface SheetViewColumn {
  id: number;
  title: string;
  type: string;
  primary?: boolean;
  workflowRole: "stage" | "overall" | "form" | null;
}

export interface SheetViewRow {
  id: number;
  rowNumber: number | null;
  createdAt: string | null;
  modifiedAt: string | null;
  values: Record<string, string>;
}

export interface SheetView {
  columns: SheetViewColumn[];
  rows: SheetViewRow[];
  workflow: {
    approvalStages: string[];
    overallColumn: string;
    source: string;
  };
}

function cellDisplay(cell: { displayValue?: unknown; value?: unknown } | undefined): string {
  if (!cell) return "";
  const v = cell.displayValue ?? cell.value;
  if (v === true) return "Yes";
  if (v === false) return "No";
  if (v === null || v === undefined) return "";
  return String(v);
}

function sheetColumns(sheet: { columns?: unknown[] }) {
  return (sheet.columns ?? []).map((c) => {
    const col = c as Record<string, unknown>;
    return {
      id: col.id as number,
      title: String(col.title),
      type: col.type as string,
      options: col.options as string[] | undefined,
      validation: col.validation as boolean | undefined,
      primary: col.primary as boolean | undefined,
      systemColumnType: col.systemColumnType as string | undefined,
    };
  });
}

/** Build a flat table representation of a Smartsheet sheet. */
export async function buildSheetView(sheet: { id?: string | number; columns?: unknown[]; rows?: unknown[] }): Promise<SheetView> {
  const wf = await resolveWorkflow(sheet);
  const stageSet = new Set(wf.approvalStages.map((s) => s.toLowerCase()));
  const overallLower = wf.overallColumn.toLowerCase();
  const formSet = new Set((await resolveFormColumns(sheet, sheetColumns(sheet))).columns.map((c) => c.id));

  const columns: SheetViewColumn[] = (sheet.columns ?? []).map((c) => {
    const col = c as { id: number; title: unknown; type: string; primary?: boolean };
    const title = String(col.title);
    const lower = title.toLowerCase();
    let workflowRole: SheetViewColumn["workflowRole"] = null;
    if (overallLower && lower === overallLower) workflowRole = "overall";
    else if (stageSet.has(lower)) workflowRole = "stage";
    else if (formSet.has(col.id)) workflowRole = "form";
    return {
      id: col.id,
      title,
      type: col.type,
      primary: col.primary,
      workflowRole,
    };
  });

  const rows: SheetViewRow[] = (sheet.rows ?? []).map((row) => {
    const r = row as {
      id: number;
      rowNumber?: number;
      createdAt?: string;
      modifiedAt?: string;
      cells?: Array<{ columnId: number; displayValue?: unknown; value?: unknown }>;
    };
    const byCol = new Map<number, { displayValue?: unknown; value?: unknown }>();
    for (const cell of r.cells ?? []) byCol.set(cell.columnId, cell);
    const values: Record<string, string> = {};
    for (const col of columns) {
      values[String(col.id)] = cellDisplay(byCol.get(col.id));
    }
    return {
      id: r.id,
      rowNumber: r.rowNumber ?? null,
      createdAt: r.createdAt ?? null,
      modifiedAt: r.modifiedAt ?? null,
      values,
    };
  });

  return {
    columns,
    rows,
    workflow: {
      approvalStages: wf.approvalStages,
      overallColumn: wf.overallColumn,
      source: wf.source,
    },
  };
}
