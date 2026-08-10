"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FormBrandHeader } from "@/components/forms/submission/FormBrandHeader";
import { StudentLoginForm } from "@/components/forms/student/StudentLoginForm";
import type { ContactChangeRequest } from "@/lib/forms/store/contact-change-requests";

type SheetSummary = {
  sheetId: string;
  name: string;
  slug: string;
  ownedRowCount: number;
};

type RowSummary = {
  rowId: number;
  label: string;
  email: string;
  createdAt: string | null;
  overall: string;
  approvalStatus: { label: string; state: string };
};

type StageOption = {
  name: string;
  isCurrent: boolean;
  pendingRequestId: string | null;
  pendingProposedName: string | null;
  pendingProposedEmail: string | null;
  contact: { currentName: string; currentEmail: string };
};

function formatWhen(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusChipClass(status: string) {
  if (status === "pending") return "border-amber-200 bg-amber-50 text-amber-900";
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-900";
  return "border-line bg-white text-sub";
}

export function StudentPortal({ initialEmail }: { initialEmail: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(initialEmail);
  const [sheets, setSheets] = useState<SheetSummary[]>([]);
  const [sheetsError, setSheetsError] = useState("");
  const [sheetsLoading, setSheetsLoading] = useState(Boolean(initialEmail));
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
  const [rows, setRows] = useState<RowSummary[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState("");
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [cells, setCells] = useState<Array<{ title: string; displayValue: string }>>([]);
  const [stages, setStages] = useState<StageOption[]>([]);
  const [history, setHistory] = useState<ContactChangeRequest[]>([]);
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [stageTitle, setStageTitle] = useState("");
  const [proposedName, setProposedName] = useState("");
  const [proposedEmail, setProposedEmail] = useState("");
  const [note, setNote] = useState("");
  const [proposeBusy, setProposeBusy] = useState(false);
  const [proposeMessage, setProposeMessage] = useState("");

  const loadSheets = useCallback(async () => {
    setSheetsLoading(true);
    setSheetsError("");
    try {
      const res = await fetch("/api/forms/student/sheets");
      const data = (await res.json().catch(() => null)) as {
        sheets?: SheetSummary[];
        email?: string;
        error?: string;
      } | null;
      if (!res.ok) {
        if (res.status === 401) {
          setEmail(null);
          setSheets([]);
          return;
        }
        throw new Error(data?.error || "Unable to load your sheets.");
      }
      if (data?.email) setEmail(data.email);
      setSheets(Array.isArray(data?.sheets) ? data.sheets : []);
    } catch (e) {
      setSheetsError(e instanceof Error ? e.message : "Unable to load your sheets.");
      setSheets([]);
    } finally {
      setSheetsLoading(false);
    }
  }, []);

  useEffect(() => {
    setEmail(initialEmail);
    if (initialEmail) {
      void loadSheets();
    } else {
      setSheets([]);
      setSelectedSheetId(null);
      setRows([]);
      setSelectedRowId(null);
    }
  }, [initialEmail, loadSheets]);

  async function loadRows(sheetId: string) {
    setSelectedSheetId(sheetId);
    setSelectedRowId(null);
    setCells([]);
    setStages([]);
    setHistory([]);
    setRowsLoading(true);
    setRowsError("");
    try {
      const res = await fetch(`/api/forms/student/sheets/${encodeURIComponent(sheetId)}/rows`);
      const data = (await res.json().catch(() => null)) as { rows?: RowSummary[]; error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Unable to load rows.");
      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (e) {
      setRows([]);
      setRowsError(e instanceof Error ? e.message : "Unable to load rows.");
    } finally {
      setRowsLoading(false);
    }
  }

  async function loadDetail(sheetId: string, rowId: number) {
    setSelectedRowId(rowId);
    setDetailLoading(true);
    setDetailError("");
    setProposeMessage("");
    try {
      const [detailRes, changeRes] = await Promise.all([
        fetch(`/api/forms/student/sheets/${encodeURIComponent(sheetId)}/rows/${rowId}`),
        fetch(`/api/forms/student/sheets/${encodeURIComponent(sheetId)}/rows/${rowId}/contact-change`),
      ]);
      const detail = (await detailRes.json().catch(() => null)) as {
        cells?: Array<{ title: string; displayValue: string }>;
        error?: string;
      } | null;
      const change = (await changeRes.json().catch(() => null)) as {
        stages?: StageOption[];
        history?: ContactChangeRequest[];
        allowedDomains?: string[];
        error?: string;
      } | null;

      if (!detailRes.ok) throw new Error(detail?.error || "Unable to load submission.");
      if (!changeRes.ok) throw new Error(change?.error || "Unable to load reroute options.");

      setCells(Array.isArray(detail?.cells) ? detail.cells : []);
      const nextStages = Array.isArray(change?.stages) ? change.stages : [];
      setStages(nextStages);
      setHistory(Array.isArray(change?.history) ? change.history : []);
      setAllowedDomains(Array.isArray(change?.allowedDomains) ? change.allowedDomains : []);
      const firstOpen = nextStages.find((s) => !s.pendingRequestId) ?? nextStages[0];
      setStageTitle(firstOpen?.name ?? "");
      setProposedName(firstOpen?.contact?.currentName ?? "");
      setProposedEmail(firstOpen?.contact?.currentEmail ?? "");
      setNote("");
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Unable to load submission.");
      setCells([]);
      setStages([]);
      setHistory([]);
    } finally {
      setDetailLoading(false);
    }
  }

  async function submitReroute(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedSheetId || selectedRowId == null) return;
    setProposeBusy(true);
    setProposeMessage("");
    try {
      const res = await fetch(
        `/api/forms/student/sheets/${encodeURIComponent(selectedSheetId)}/rows/${selectedRowId}/contact-change`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stageTitle, proposedName, proposedEmail, note }),
        },
      );
      const data = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Unable to submit reroute.");
      setProposeMessage(data?.message || "Reroute submitted for review.");
      await loadDetail(selectedSheetId, selectedRowId);
    } catch (e) {
      setProposeMessage(e instanceof Error ? e.message : "Unable to submit reroute.");
    } finally {
      setProposeBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/forms/student/sign-out", { method: "POST" });
    setEmail(null);
    setSheets([]);
    setSelectedSheetId(null);
    setRows([]);
    setSelectedRowId(null);
    startTransition(() => {
      router.refresh();
    });
  }

  const selectedStage = stages.find((s) => s.name === stageTitle);
  const stagePending = Boolean(selectedStage?.pendingRequestId);

  return (
    <div className="min-h-screen bg-[color:var(--wsu-stone,#f7f5f2)] text-[color:var(--wsu-ink)]">
      <FormBrandHeader
        {...(email
          ? {
              actionsLabel: "Student account",
              actions: (
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                  <p className="min-w-0 truncate text-sm font-medium text-[color:var(--wsu-ink)]" title={email}>
                    {email}
                  </p>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    aria-label="Sign out"
                    title="Sign out"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--crimson-line)] bg-white text-crimson transition hover:bg-[var(--crimson-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crimson"
                  >
                    <svg
                      className="h-[18px] w-[18px]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                      <path d="M16 17l5-5-5-5M21 12H9" />
                    </svg>
                  </button>
                </div>
              ),
            }
          : {})}
      />

      <div className="px-4 py-8 sm:px-7 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <header className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--wsu-crimson)]">
              Graduate School
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">My submissions</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[color:var(--wsu-muted)]">
              {email
                ? "View sheets that include you, open your rows, and propose contact reroutes for Programs Team review."
                : "Sign in with your @wsu.edu Student Email to see sheets that include you, view your rows, and propose contact reroutes for Programs Team review."}
            </p>
          </header>

          {!email ? (
            <div className="mx-auto max-w-md rounded-2xl border border-[color:var(--wsu-border)] bg-white p-6 shadow-sm sm:p-8">
              <StudentLoginForm returnHref="/forms/my" />
            </div>
          ) : (
            <div className="space-y-6">
      <section className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-[color:var(--wsu-ink)]">Your sheets</h2>
        <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">
          Sheets where your email appears as Student Email.
        </p>
        {sheetsLoading ? <p className="mt-4 text-sm text-sub">Loading…</p> : null}
        {sheetsError ? (
          <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {sheetsError}
          </p>
        ) : null}
        {!sheetsLoading && !sheetsError && sheets.length === 0 ? (
          <p className="mt-4 text-sm text-sub">No matching sheets found for your email.</p>
        ) : null}
        <ul className="mt-4 space-y-2">
          {sheets.map((sheet) => (
            <li key={sheet.sheetId}>
              <button
                type="button"
                onClick={() => void loadRows(sheet.sheetId)}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition ${
                  selectedSheetId === sheet.sheetId
                    ? "border-crimson bg-[var(--crimson-soft)]"
                    : "border-line bg-white hover:border-mist"
                }`}
              >
                <span className="font-medium text-ink">{sheet.name}</span>
                <span className="text-xs text-sub">
                  {sheet.ownedRowCount} row{sheet.ownedRowCount === 1 ? "" : "s"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {selectedSheetId ? (
        <section className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[color:var(--wsu-ink)]">Your rows</h2>
          {rowsLoading ? <p className="mt-4 text-sm text-sub">Loading…</p> : null}
          {rowsError ? (
            <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {rowsError}
            </p>
          ) : null}
          <ul className="mt-4 space-y-2">
            {rows.map((row) => (
              <li key={row.rowId}>
                <button
                  type="button"
                  onClick={() => void loadDetail(selectedSheetId, row.rowId)}
                  className={`flex w-full flex-col rounded-xl border px-4 py-3 text-left text-sm transition ${
                    selectedRowId === row.rowId
                      ? "border-crimson bg-[var(--crimson-soft)]"
                      : "border-line bg-white hover:border-mist"
                  }`}
                >
                  <span className="font-medium text-ink">{row.label}</span>
                  <span className="mt-1 text-xs text-sub">{row.approvalStatus?.label || row.overall}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {selectedSheetId && selectedRowId != null ? (
        <section className="space-y-4 rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[color:var(--wsu-ink)]">Submission detail</h2>
          {detailLoading ? <p className="text-sm text-sub">Loading…</p> : null}
          {detailError ? (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {detailError}
            </p>
          ) : null}

          {!detailLoading && cells.length > 0 ? (
            <dl className="grid gap-3 sm:grid-cols-2">
              {cells
                .filter((c) => c.displayValue)
                .map((cell) => (
                  <div key={cell.title} className="rounded-xl border border-line px-3 py-2">
                    <dt className="text-xs font-medium text-sub">{cell.title}</dt>
                    <dd className="mt-1 text-sm text-ink">{cell.displayValue}</dd>
                  </div>
                ))}
            </dl>
          ) : null}

          <div className="border-t border-line pt-4">
            <h3 className="text-base font-semibold text-ink">Propose contact reroute</h3>
            <p className="mt-1 text-sm text-sub">
              Requests go to the Programs Team. The contact does not change until approved.
              {allowedDomains.length ? ` Allowed domains: ${allowedDomains.join(", ")}.` : ""}
            </p>

            {stages.length === 0 ? (
              <p className="mt-3 text-sm text-sub">No editable approval stages for this submission.</p>
            ) : (
              <form onSubmit={(e) => void submitReroute(e)} className="mt-4 space-y-3">
                <label className="block space-y-1 text-sm">
                  <span className="font-medium text-ink">Stage</span>
                  <select
                    value={stageTitle}
                    onChange={(e) => {
                      const next = e.target.value;
                      setStageTitle(next);
                      const st = stages.find((s) => s.name === next);
                      setProposedName(st?.contact?.currentName ?? "");
                      setProposedEmail(st?.contact?.currentEmail ?? "");
                    }}
                    className="w-full rounded-xl border border-line bg-white px-3 py-2"
                  >
                    {stages.map((st) => (
                      <option key={st.name} value={st.name}>
                        {st.name}
                        {st.pendingRequestId ? " (pending review)" : ""}
                        {st.isCurrent ? " — current" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium text-ink">New contact name</span>
                  <input
                    value={proposedName}
                    onChange={(e) => setProposedName(e.target.value)}
                    disabled={stagePending}
                    className="w-full rounded-xl border border-line px-3 py-2 disabled:bg-stone-50"
                    required
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium text-ink">New contact email</span>
                  <input
                    type="email"
                    value={proposedEmail}
                    onChange={(e) => setProposedEmail(e.target.value)}
                    disabled={stagePending}
                    className="w-full rounded-xl border border-line px-3 py-2 disabled:bg-stone-50"
                    required
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium text-ink">Note (optional)</span>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={stagePending}
                    rows={3}
                    className="w-full rounded-xl border border-line px-3 py-2 disabled:bg-stone-50"
                  />
                </label>
                {stagePending ? (
                  <p className="text-sm text-amber-800">
                    A reroute for this stage is already pending Programs Team review
                    {selectedStage?.pendingProposedName || selectedStage?.pendingProposedEmail
                      ? ` (${[selectedStage.pendingProposedName, selectedStage.pendingProposedEmail]
                          .filter(Boolean)
                          .join(" · ")})`
                      : ""}
                    .
                  </p>
                ) : null}
                {proposeMessage ? <p className="text-sm text-sub">{proposeMessage}</p> : null}
                <button
                  type="submit"
                  disabled={proposeBusy || stagePending || !stageTitle}
                  className="rounded-full bg-crimson px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {proposeBusy ? "Submitting…" : "Submit for review"}
                </button>
              </form>
            )}
          </div>

          <div className="border-t border-line pt-4">
            <h3 className="text-base font-semibold text-ink">Reroute status</h3>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-sub">No reroute requests yet for this submission.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {history.map((req) => (
                  <li key={req.id} className="rounded-xl border border-line px-3 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${statusChipClass(req.status)}`}>
                        {req.status}
                      </span>
                      <span className="rounded-full border border-line bg-white px-2 py-0.5 text-xs text-sub">
                        {req.requestedByKind === "student" ? "Student" : "Staff"}
                      </span>
                      <span className="text-xs text-sub">{formatWhen(req.requestedAt)}</span>
                    </div>
                    <p className="mt-2 font-medium text-ink">{req.stageTitle}</p>
                    <p className="mt-1 text-sub">
                      Requested by {req.requestedBy.name}
                      {req.requestedBy.email ? ` (${req.requestedBy.email})` : ""}
                    </p>
                    <p className="mt-1 text-ink">
                      To: {[req.proposedName, req.proposedEmail].filter(Boolean).join(" · ")}
                    </p>
                    {req.note ? <p className="mt-1 text-xs text-sub">Note: {req.note}</p> : null}
                    {req.reviewedBy ? (
                      <p className="mt-1 text-xs text-sub">
                        Reviewed by {req.reviewedBy.name}
                        {req.reviewedAt ? ` · ${formatWhen(req.reviewedAt)}` : ""}
                        {req.reviewNote ? ` — ${req.reviewNote}` : ""}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
