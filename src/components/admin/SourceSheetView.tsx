"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  SheetGridView,
  type SheetGridColumn,
  type SheetGridRow,
  type SheetGridWorkflow,
} from "@/components/forms/sheet/SheetGridView";
import { SubmissionDetailModal } from "@/components/forms/tracker/SubmissionDetailModal";

interface SourceSheetViewProps {
  sourceId: string;
  sheetId: string;
  sourceLabel: string;
}

export function SourceSheetView({ sourceId, sheetId, sourceLabel }: SourceSheetViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sheetName, setSheetName] = useState("");
  const [columns, setColumns] = useState<SheetGridColumn[]>([]);
  const [rows, setRows] = useState<SheetGridRow[]>([]);
  const [workflow, setWorkflow] = useState<SheetGridWorkflow | null>(null);
  const [totalRowCount, setTotalRowCount] = useState<number | null>(null);
  const [approvedValues, setApprovedValues] = useState<string[]>([]);
  const [declinedValues, setDeclinedValues] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [resendBusyRowId, setResendBusyRowId] = useState<number | null>(null);
  const [workflowCount, setWorkflowCount] = useState(0);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSheet = useCallback(
    (silent = false) => {
      if (!sheetId) return;
      if (silent) setRefreshing(true);
      else setLoading(true);
      fetch(`/api/forms/sheet-view?sheetId=${encodeURIComponent(sheetId)}`)
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || d.message || "Could not load sheet.");
          return d;
        })
        .then(async (d) => {
          setSheetName(d.sheetName);
          setColumns(d.columns ?? []);
          setRows(d.rows ?? []);
          setWorkflow(d.workflow ?? null);
          setTotalRowCount(d.totalRowCount ?? d.rows?.length ?? null);
          setApprovedValues(d.workflow?.approvedValues ?? []);
          setDeclinedValues(d.workflow?.declinedValues ?? []);
          setError("");
          try {
            const wfRes = await fetch(
              `/api/forms/workflows?sheetId=${encodeURIComponent(sheetId)}`,
              { cache: "no-store" },
            );
            const wfData = (await wfRes.json().catch(() => ({}))) as { workflows?: unknown[] };
            setWorkflowCount(wfRes.ok ? (wfData.workflows?.length ?? 0) : 0);
          } catch {
            setWorkflowCount(0);
          }
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Could not load sheet."))
        .finally(() => {
          if (silent) setRefreshing(false);
          else setLoading(false);
        });
    },
    [sheetId],
  );

  useEffect(() => {
    const rowFromUrl = Number(searchParams.get("rowId") ?? "");
    setSelectedRowId(Number.isFinite(rowFromUrl) && rowFromUrl > 0 ? rowFromUrl : null);
    setNotice("");
    loadSheet();
  }, [loadSheet, searchParams]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  async function handleResend(row: SheetGridRow, column: SheetGridColumn) {
    setResendBusyRowId(row.id);
    setNotice("");
    setError("");
    try {
      const r = await fetch(`/api/forms/submissions/${row.id}/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnTitle: column.title, sheetId }),
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

  function handleRowClick(row: SheetGridRow) {
    setSelectedRowId(row.id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("rowId", String(row.id));
    router.replace(`/admin/sources/${encodeURIComponent(sourceId)}/sheet?${params.toString()}`, {
      scroll: false,
    });
  }

  function handleCloseDetail() {
    setSelectedRowId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("rowId");
    const qs = params.toString();
    router.replace(
      `/admin/sources/${encodeURIComponent(sourceId)}/sheet${qs ? `?${qs}` : ""}`,
      { scroll: false },
    );
  }

  if (error && !sheetName) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
    );
  }

  if (loading || !sheetName) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center rounded-xl border border-line-strong bg-white">
        <p className="text-sm text-sub">Loading sheet for {sourceLabel}…</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}
      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {notice}
        </div>
      ) : null}
      <SheetGridView
        sheetName={sheetName}
        columns={columns}
        rows={rows}
        workflow={workflow}
        totalRowCount={totalRowCount}
        approvedValues={approvedValues}
        declinedValues={declinedValues}
        selectedSheetId={sheetId}
        onRowClick={handleRowClick}
        onResend={handleResend}
        resendBusyRowId={resendBusyRowId}
        onRefresh={() => loadSheet(true)}
        refreshing={refreshing}
        workflowCount={workflowCount}
        variant="source"
        sourceId={sourceId}
      />
      <SubmissionDetailModal
        rowId={selectedRowId}
        sheetId={sheetId}
        open={selectedRowId != null}
        onClose={handleCloseDetail}
        onChanged={() => loadSheet(true)}
      />
    </div>
  );
}
