"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormsWorkspaceChrome } from "@/components/forms/layout/FormsWorkspaceChrome";
import {
  SheetGridView,
  type SheetGridColumn,
  type SheetGridRow,
  type SheetGridWorkflow,
} from "@/components/forms/sheet/SheetGridView";
import { SubmissionDetailModal } from "@/components/forms/tracker/SubmissionDetailModal";

type FormOption = { id: string; name: string };

export default function SheetViewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSheetId = searchParams.get("sheetId")?.trim() ?? "";

  const [forms, setForms] = useState<FormOption[]>([]);
  const [activeSheetId, setActiveSheetId] = useState("");
  const [selectedSheetId, setSelectedSheetId] = useState("");
  const [formsReady, setFormsReady] = useState(false);
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

  useEffect(() => {
    fetch("/api/forms/registry")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || d.message || "Could not load forms.");
        return d as { forms?: FormOption[]; activeSheetId?: string };
      })
      .then((d) => {
        const list = (d.forms ?? [])
          .filter((f) => f?.id)
          .map((f) => ({ id: String(f.id), name: f.name || String(f.id) }));
        setForms(list);
        setActiveSheetId(d.activeSheetId ? String(d.activeSheetId) : "");
        setFormsReady(true);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Could not load forms.");
        setFormsReady(true);
        setLoading(false);
      });
  }, []);

  // Resolve selection from URL, then active, then first form; keep ?sheetId= in sync.
  useEffect(() => {
    if (!formsReady || !forms.length) return;

    const urlValid = urlSheetId && forms.some((f) => f.id === urlSheetId) ? urlSheetId : "";
    const activeValid =
      activeSheetId && forms.some((f) => f.id === activeSheetId) ? activeSheetId : "";
    const next = urlValid || activeValid || forms[0].id;

    setSelectedSheetId((prev) => (prev === next ? prev : next));

    if (urlSheetId !== next) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("sheetId", next);
      router.replace(`/forms/sheet?${params.toString()}`, { scroll: false });
    }
  }, [formsReady, forms, urlSheetId, activeSheetId, searchParams, router]);

  const loadSheet = useCallback(
    (silent = false) => {
      if (!selectedSheetId) return;
      if (silent) setRefreshing(true);
      else setLoading(true);
      fetch(`/api/forms/sheet-view?sheetId=${encodeURIComponent(selectedSheetId)}`)
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
    },
    [selectedSheetId],
  );

  const scheduleSheetRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    // Debounce bursts of Smartsheet webhook events into one grid reload.
    refreshTimerRef.current = setTimeout(() => loadSheet(true), 400);
  }, [loadSheet]);

  useEffect(() => {
    if (!selectedSheetId) {
      if (formsReady && forms.length === 0) setLoading(false);
      return;
    }
    setSelectedRowId(null);
    setNotice("");
    loadSheet();
  }, [selectedSheetId, loadSheet, formsReady, forms.length]);

  // Live updates only when Smartsheet posts a webhook for the selected sheet.
  useEffect(() => {
    if (!selectedSheetId) return;
    const source = new EventSource("/api/forms/sync/stream");
    source.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data) as { type?: string; sheetId?: number | string };
        if (data.type !== "sheet_changed") return;
        const eventSheetId = data.sheetId != null ? String(data.sheetId) : "";
        if (eventSheetId && eventSheetId !== selectedSheetId) return;
        scheduleSheetRefresh();
      } catch {
        // ignore malformed frames
      }
    };
    return () => {
      source.close();
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [scheduleSheetRefresh, selectedSheetId]);

  function handleSheetChange(sheetId: string) {
    if (!sheetId || sheetId === selectedSheetId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("sheetId", sheetId);
    router.replace(`/forms/sheet?${params.toString()}`, { scroll: false });
  }

  async function handleResend(row: SheetGridRow, column: SheetGridColumn) {
    if (!selectedSheetId) return;
    setResendBusyRowId(row.id);
    setNotice("");
    setError("");
    try {
      const r = await fetch(`/api/forms/submissions/${row.id}/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnTitle: column.title, sheetId: selectedSheetId }),
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

  if (formsReady && forms.length === 0) {
    return (
      <FormsWorkspaceChrome>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {error || "No forms registered yet. Create or import a form on Manage first."}
        </div>
      </FormsWorkspaceChrome>
    );
  }

  if (error && !sheetName) {
    return (
      <FormsWorkspaceChrome>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      </FormsWorkspaceChrome>
    );
  }

  if (loading || !sheetName || !selectedSheetId) {
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
        forms={forms}
        selectedSheetId={selectedSheetId}
        onSheetChange={handleSheetChange}
        onRowClick={(row) => setSelectedRowId(row.id)}
        onResend={handleResend}
        resendBusyRowId={resendBusyRowId}
        onRefresh={() => loadSheet(true)}
        refreshing={refreshing}
      />
      <SubmissionDetailModal
        rowId={selectedRowId}
        sheetId={selectedSheetId}
        open={selectedRowId != null}
        onClose={() => setSelectedRowId(null)}
        onChanged={() => loadSheet(true)}
      />
    </FormsWorkspaceChrome>
  );
}
