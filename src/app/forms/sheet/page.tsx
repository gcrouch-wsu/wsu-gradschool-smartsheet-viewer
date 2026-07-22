"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [resendBusyRowId, setResendBusyRowId] = useState<number | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSheet = useCallback((silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
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
        if (silent) setRefreshing(false);
        else setLoading(false);
      });
  }, []);

  const scheduleSheetRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    // Debounce bursts of Smartsheet webhook events into one grid reload.
    refreshTimerRef.current = setTimeout(() => loadSheet(true), 400);
  }, [loadSheet]);

  useEffect(() => {
    loadSheet();
  }, [loadSheet]);

  // Live updates only when Smartsheet posts a webhook (row/column/sheet change).
  useEffect(() => {
    const source = new EventSource("/api/forms/sync/stream");
    source.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data) as { type?: string };
        if (data.type === "sheet_changed") scheduleSheetRefresh();
      } catch {
        // ignore malformed frames
      }
    };
    return () => {
      source.close();
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [scheduleSheetRefresh]);

  async function handleResend(row: SheetGridRow, column: SheetGridColumn) {
    setResendBusyRowId(row.id);
    setNotice("");
    setError("");
    try {
      const r = await fetch(`/api/forms/submissions/${row.id}/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnTitle: column.title }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.message || "Resend failed.");
      setNotice(typeof d.message === "string" ? d.message : "Resend triggered.");
      loadSheet(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Resend failed.");
    } finally {
      setResendBusyRowId(null);
    }
  }

  if (error && !sheetName) {
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
      {error ? (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}
      {notice ? (
        <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</div>
      ) : null}
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
        onResend={handleResend}
        resendBusyRowId={resendBusyRowId}
        onRefresh={() => loadSheet(true)}
        refreshing={refreshing}
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
