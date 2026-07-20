"use client";

import { useCallback, useEffect, useState } from "react";
import { FormsWorkspaceChrome } from "@/components/forms/layout/FormsWorkspaceChrome";
import {
  SheetGridView,
  type SheetGridColumn,
  type SheetGridRow,
  type SheetGridWorkflow,
} from "@/components/forms/sheet/SheetGridView";
import { SubmissionDetailModal } from "@/components/forms/tracker/SubmissionDetailModal";

export default function SheetViewPage() {
  const [sheetName, setSheetName] = useState("");
  const [columns, setColumns] = useState<SheetGridColumn[]>([]);
  const [rows, setRows] = useState<SheetGridRow[]>([]);
  const [workflow, setWorkflow] = useState<SheetGridWorkflow | null>(null);
  const [totalRowCount, setTotalRowCount] = useState<number | null>(null);
  const [demo, setDemo] = useState(false);
  const [approvedValues, setApprovedValues] = useState<string[]>([]);
  const [declinedValues, setDeclinedValues] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);

  const loadSheet = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    fetch("/api/forms/sheet-view")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || d.message || "Could not load sheet.");
        return d;
      })
      .then((d) => {
        setSheetName(d.sheetName);
        setColumns(d.columns ?? []);
        setRows(d.rows ?? []);
        setWorkflow(d.workflow ?? null);
        setTotalRowCount(d.totalRowCount ?? d.rows?.length ?? null);
        setDemo(d.demo);
        setApprovedValues(d.workflow?.approvedValues ?? []);
        setDeclinedValues(d.workflow?.declinedValues ?? []);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load sheet."))
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadSheet();
  }, [loadSheet]);

  if (error) {
    return (
      <FormsWorkspaceChrome>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      </FormsWorkspaceChrome>
    );
  }

  if (loading || !sheetName) {
    return (
      <FormsWorkspaceChrome>
        <div className="flex min-h-[12rem] items-center justify-center rounded-xl border border-[color:var(--wsu-border)] bg-white">
          <p className="text-sm text-[color:var(--wsu-muted)]">Loading sheet grid…</p>
        </div>
      </FormsWorkspaceChrome>
    );
  }

  return (
    <FormsWorkspaceChrome>
      <SheetGridView
        sheetName={sheetName}
        demo={demo}
        columns={columns}
        rows={rows}
        workflow={workflow}
        totalRowCount={totalRowCount}
        approvedValues={approvedValues}
        declinedValues={declinedValues}
        onRowClick={(row) => setSelectedRowId(row.id)}
      />
      <SubmissionDetailModal
        rowId={selectedRowId}
        open={selectedRowId != null}
        onClose={() => setSelectedRowId(null)}
        onChanged={() => loadSheet(true)}
      />
    </FormsWorkspaceChrome>
  );
}
