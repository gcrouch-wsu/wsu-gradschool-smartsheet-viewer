"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ContactChangeRequest } from "@/lib/forms/store/contact-change-requests";
import { AttachmentPreviewDialog } from "@/components/forms/tracker/AttachmentPreviewDialog";
import type { TrackerAttachment } from "@/components/forms/tracker/types";

type StageOption = {
  name: string;
  isCurrent: boolean;
  pendingRequestId: string | null;
  pendingProposedName: string | null;
  pendingProposedEmail: string | null;
  contact: { currentName: string; currentEmail: string };
};

type DetailTab = "details" | "reroute" | "history";

function requestStatusClass(status: string) {
  if (status === "pending") return "border-amber-200 bg-amber-50 text-amber-900";
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  return "border-rose-200 bg-rose-50 text-rose-900";
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function StudentSubmissionDetail({ sheetId, rowId }: { sheetId: string; rowId: string }) {
  const [cells, setCells] = useState<Array<{ title: string; displayValue: string }>>([]);
  const [stages, setStages] = useState<StageOption[]>([]);
  const [history, setHistory] = useState<ContactChangeRequest[]>([]);
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [previewPdfName, setPreviewPdfName] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<TrackerAttachment | null>(null);
  const [attachments, setAttachments] = useState<TrackerAttachment[]>([]);
  const [hasGeneratedPdf, setHasGeneratedPdf] = useState(false);
  const [sheetName, setSheetName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stageTitle, setStageTitle] = useState("");
  const [proposedName, setProposedName] = useState("");
  const [proposedEmail, setProposedEmail] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState<DetailTab>("details");

  const rowPath = `/api/forms/student/sheets/${encodeURIComponent(sheetId)}/rows/${encodeURIComponent(rowId)}`;
  const reroutePath = `${rowPath}/contact-change`;
  const pdfPreviewPath = `${rowPath}/pdf-preview`;
  const attachmentsPath = `${rowPath}/attachments`;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [detailResponse, rerouteResponse, attachmentsResponse, pdfMetaResponse] = await Promise.all([
        fetch(rowPath),
        fetch(reroutePath),
        fetch(attachmentsPath),
        fetch(`${pdfPreviewPath}?meta=1`),
      ]);
      const detail = (await detailResponse.json().catch(() => null)) as {
        name?: string;
        cells?: Array<{ title: string; displayValue: string }>;
        error?: string;
      } | null;
      const reroute = (await rerouteResponse.json().catch(() => null)) as {
        stages?: StageOption[];
        history?: ContactChangeRequest[];
        allowedDomains?: string[];
        error?: string;
      } | null;
      const attachmentsData = (await attachmentsResponse.json().catch(() => null)) as {
        attachments?: TrackerAttachment[];
      } | null;
      if (!detailResponse.ok) throw new Error(detail?.error ?? "Unable to load this submission.");
      if (!rerouteResponse.ok) throw new Error(reroute?.error ?? "Unable to load reroute information.");

      const nextStages = Array.isArray(reroute?.stages) ? reroute.stages : [];
      setSheetName(detail?.name ?? "");
      setCells(Array.isArray(detail?.cells) ? detail.cells : []);
      setStages(nextStages);
      setHistory(Array.isArray(reroute?.history) ? reroute.history : []);
      setAllowedDomains(Array.isArray(reroute?.allowedDomains) ? reroute.allowedDomains : []);
      setAttachments(attachmentsResponse.ok && Array.isArray(attachmentsData?.attachments) ? attachmentsData.attachments : []);
      setHasGeneratedPdf(pdfMetaResponse.ok);
      const nextStage = nextStages.find((stage) => !stage.pendingRequestId) ?? nextStages[0];
      setStageTitle(nextStage?.name ?? "");
      setProposedName(nextStage?.contact.currentName ?? "");
      setProposedEmail(nextStage?.contact.currentEmail ?? "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load this submission.");
    } finally {
      setLoading(false);
    }
  }, [attachmentsPath, pdfPreviewPath, reroutePath, rowPath]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedStage = useMemo(() => stages.find((stage) => stage.name === stageTitle), [stageTitle, stages]);
  const attachedPdf = useMemo(
    () => attachments.find((attachment) => attachment.mimeType === "application/pdf" || /\.pdf$/i.test(attachment.name)) ?? null,
    [attachments],
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setNotice("");
    try {
      const response = await fetch(reroutePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageTitle, proposedName, proposedEmail, note }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to submit the reroute.");
      setNotice(data?.message ?? "Reroute submitted for Programs Team review.");
      setNote("");
      await load();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Unable to submit the reroute.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {loading ? <p className="rounded-xl border border-line bg-white px-5 py-6 text-sm text-sub">Loading submission…</p> : null}
      {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}
      {!loading && !error ? (
        <>
          <div className="grid grid-cols-3 border-b border-line" role="tablist" aria-label="Submission sections">
            {([
              ["details", "Submission details"],
              ["reroute", "Contact reroute"],
              ["history", "Request history"],
            ] as const).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={`border-b-2 px-3 py-3 text-center text-sm font-medium transition ${
                  activeTab === tab
                    ? "border-crimson text-crimson"
                    : "border-transparent text-sub hover:border-mist hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === "details" ? (
          <section className="rounded-xl border border-line bg-surface" role="tabpanel">
            <div className="border-b border-line px-5 py-5">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-crimson">Submission detail</p>
              <h2 className="mt-1 text-xl font-semibold text-ink">{sheetName || "My submission"}</h2>
            </div>
            <dl className="grid gap-px bg-line sm:grid-cols-2">
              {cells.filter((cell) => cell.displayValue).map((cell) => (
                <div key={cell.title} className="bg-surface px-5 py-4">
                  <dt className="text-xs font-medium text-sub">{cell.title}</dt>
                  <dd className="mt-1 text-sm text-ink">
                    {/^file\s*name$/i.test(cell.title) ? (
                      hasGeneratedPdf ? (
                        <button
                          type="button"
                          onClick={() => setPreviewPdfName(cell.displayValue)}
                          className="text-left font-medium text-crimson underline-offset-2 hover:underline"
                        >
                          {cell.displayValue}
                        </button>
                      ) : attachedPdf ? (
                        <button
                          type="button"
                          onClick={() => setPreviewAttachment(attachedPdf)}
                          className="text-left font-medium text-crimson underline-offset-2 hover:underline"
                        >
                          {cell.displayValue}
                        </button>
                      ) : (
                        <span>
                          {cell.displayValue}
                          <span className="ml-2 text-xs text-sub">(PDF unavailable)</span>
                        </span>
                      )
                    ) : (
                      cell.displayValue
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          ) : null}

          {activeTab === "reroute" ? (
          <section className="rounded-xl border border-line bg-surface p-5">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-crimson">Contact reroute</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">Propose a contact change</h2>
            <p className="mt-1 text-sm text-sub">
              Requests are reviewed by Programs Team before Smartsheet contacts change.
              {allowedDomains.length ? ` Allowed domains: ${allowedDomains.join(", ")}.` : ""}
            </p>
            {stages.length === 0 ? <p className="mt-4 text-sm text-sub">There are no editable approval stages.</p> : (
              <form onSubmit={(event) => void submit(event)} className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-sm sm:col-span-2">
                  <span className="font-medium text-ink">Approval stage</span>
                  <select
                    value={stageTitle}
                    onChange={(event) => {
                      const next = stages.find((stage) => stage.name === event.target.value);
                      setStageTitle(event.target.value);
                      setProposedName(next?.contact.currentName ?? "");
                      setProposedEmail(next?.contact.currentEmail ?? "");
                    }}
                    className="w-full rounded-lg border border-line bg-white px-3 py-2.5"
                  >
                    {stages.map((stage) => <option key={stage.name} value={stage.name}>{stage.name}{stage.pendingRequestId ? " (pending)" : ""}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-ink">New contact name</span>
                  <input required disabled={Boolean(selectedStage?.pendingRequestId)} value={proposedName} onChange={(event) => setProposedName(event.target.value)} className="w-full rounded-lg border border-line px-3 py-2.5 disabled:bg-stone-50" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-ink">New contact email</span>
                  <input required type="email" disabled={Boolean(selectedStage?.pendingRequestId)} value={proposedEmail} onChange={(event) => setProposedEmail(event.target.value)} className="w-full rounded-lg border border-line px-3 py-2.5 disabled:bg-stone-50" />
                </label>
                <label className="space-y-1 text-sm sm:col-span-2">
                  <span className="font-medium text-ink">Note (optional)</span>
                  <textarea disabled={Boolean(selectedStage?.pendingRequestId)} value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="w-full rounded-lg border border-line px-3 py-2.5 disabled:bg-stone-50" />
                </label>
                {selectedStage?.pendingRequestId ? <p className="text-sm text-amber-800 sm:col-span-2">A request for this stage is already pending review.</p> : null}
                {notice ? <p className="text-sm text-sub sm:col-span-2">{notice}</p> : null}
                <div className="sm:col-span-2">
                  <button type="submit" disabled={submitting || Boolean(selectedStage?.pendingRequestId)} className="rounded-lg border border-crimson bg-crimson px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
                    {submitting ? "Submitting…" : "Submit for review"}
                  </button>
                </div>
              </form>
            )}
          </section>
          ) : null}

          {activeTab === "history" ? (
          <section className="rounded-xl border border-line bg-surface">
            <div className="border-b border-line px-5 py-5">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-crimson">Request history</p>
              <h2 className="mt-1 text-xl font-semibold text-ink">Reroute status</h2>
            </div>
            {history.length === 0 ? <p className="px-5 py-6 text-sm text-sub">No reroute requests have been submitted.</p> : (
              <ul className="divide-y divide-line">
                {history.map((request) => (
                  <li key={request.id} className="px-5 py-4 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${requestStatusClass(request.status)}`}>{request.status}</span>
                      <span className="text-xs text-sub">{request.requestedByKind === "student" ? "Student" : "Staff"} · {dateTime(request.requestedAt)}</span>
                    </div>
                    <p className="mt-2 font-medium text-ink">{request.stageTitle}: {request.proposedName} · {request.proposedEmail}</p>
                    <p className="mt-1 text-xs text-sub">Requested by {request.requestedBy.name}{request.reviewedBy ? ` · reviewed by ${request.reviewedBy.name}` : ""}</p>
                    {request.reviewNote ? <p className="mt-1 text-xs text-sub">{request.reviewNote}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
          ) : null}
        </>
      ) : null}
      <AttachmentPreviewDialog
        open={Boolean(previewPdfName || previewAttachment)}
        onClose={() => {
          setPreviewPdfName(null);
          setPreviewAttachment(null);
        }}
        attachment={
          previewPdfName
            ? { id: 0, name: previewPdfName, mimeType: "application/pdf" }
            : previewAttachment
        }
        rowId={Number(rowId)}
        attachmentPreviewPath={previewPdfName ? pdfPreviewPath : undefined}
        attachmentApiBasePath={previewAttachment ? attachmentsPath : undefined}
      />
    </div>
  );
}
