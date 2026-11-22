"use client";

import { useState } from "react";
import { EmailTraceDrawer } from "@/components/workflows/EmailTraceDrawer";
import type { EmailTraceNotice } from "@/lib/workflows/email-trace";
import { getWorkflowTemplate } from "@/lib/workflows/catalog";
import type { WorkflowDeliveryRecord, WorkflowRecord, WorkflowRunRecord } from "@/lib/workflows/types";

type RunDelivery = WorkflowDeliveryRecord & { sesNotices?: EmailTraceNotice[] };

function retryLabel(run: WorkflowRunRecord): string {
  if (run.status !== "failed") return run.status;
  if (!run.nextRetryAt) return `Failed after ${run.attemptCount} attempts`;
  const when = new Date(run.nextRetryAt);
  const remaining = when.getTime() - Date.now();
  if (remaining <= 0) return "Failed · retrying now";
  const seconds = Math.ceil(remaining / 1000);
  return `Failed · retries in ${seconds}s`;
}

function statusOf(workflow: WorkflowRecord, failure?: WorkflowRunRecord): "Failed" | "Enabled" | "Draft" {
  if (failure) return "Failed";
  return workflow.enabled ? "Enabled" : "Draft";
}

const STATUS_CLASS = {
  Failed: "bg-[color-mix(in_srgb,var(--product-err)_12%,white)] text-[color:var(--product-err)]",
  Enabled: "bg-[color-mix(in_srgb,var(--product-ok)_12%,white)] text-[color:var(--product-ok)]",
  Draft: "bg-[color:var(--wsu-stone)] text-[color:var(--wsu-muted)]",
} as const;

const rowActionClass =
  "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium text-[color:var(--wsu-muted)] transition hover:bg-[color:var(--wsu-stone)] hover:text-[color:var(--wsu-ink)] disabled:opacity-50";

export function WorkflowList({
  workflows,
  failures,
  selectedId,
  onEdit,
  onPreview,
  onDelete,
  onChanged,
}: {
  workflows: WorkflowRecord[];
  failures: WorkflowRunRecord[];
  selectedId: string | null;
  onEdit: (workflow: WorkflowRecord) => void;
  onPreview: (id: string) => void;
  onDelete: (id: string) => void;
  onChanged: () => void;
}) {
  const failureByWorkflow = new Map(failures.map((run) => [run.workflowId, run]));

  if (!workflows.length) {
    return (
      <p className="px-3 py-10 text-center text-sm leading-6 text-[color:var(--wsu-muted)]">
        No workflows on this sheet yet. Start one with New workflow.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {workflows.map((workflow) => {
        const failure = failureByWorkflow.get(workflow.id);
        const selected = workflow.id === selectedId;
        const status = statusOf(workflow, failure);
        const templateTitle = getWorkflowTemplate(workflow.templateKind)?.title ?? workflow.templateKind;
        return (
          <li
            key={workflow.id}
            className={[
              "rounded-xl border px-3 py-2.5 transition",
              selected
                ? "border-[color:var(--wsu-crimson)] bg-[var(--crimson-soft)] shadow-[inset_3px_0_0_var(--wsu-crimson)]"
                : "border-transparent bg-white hover:border-[var(--crimson-line)] hover:bg-[color:var(--wsu-paper)]",
            ].join(" ")}
          >
            <button
              type="button"
              className="w-full rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--wsu-crimson)]"
              aria-current={selected ? "true" : undefined}
              onClick={() => onEdit(workflow)}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-[color:var(--wsu-ink)]">
                    {workflow.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-[color:var(--wsu-muted)]">
                    {templateTitle}
                  </span>
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[status]}`}>
                  {status}
                </span>
              </span>
              {failure ? (
                <span className="mt-1.5 block text-xs leading-5 text-[color:var(--product-err)]">
                  {failure.error || retryLabel(failure)}
                </span>
              ) : null}
            </button>
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {workflow.templateKind === "alert" && workflow.id ? (
                <button type="button" className={rowActionClass} onClick={() => onPreview(workflow.id)}>
                  Send preview
                </button>
              ) : null}
              <button type="button" className={rowActionClass} onClick={() => onDelete(workflow.id)}>
                Delete
              </button>
            </div>
            {workflow.id ? <RunHistory workflowId={workflow.id} onChanged={onChanged} /> : null}
          </li>
        );
      })}
    </ul>
  );
}

function RunHistory({ workflowId, onChanged }: { workflowId: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<WorkflowRunRecord[] | null>(null);
  const [deliveries, setDeliveries] = useState<RunDelivery[]>([]);
  const [trace, setTrace] = useState<RunDelivery | null>(null);
  const [error, setError] = useState("");
  const [busyRow, setBusyRow] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/forms/workflows/${workflowId}/runs`, { cache: "no-store" });
    const data = (await res.json()) as {
      runs?: WorkflowRunRecord[];
      deliveries?: RunDelivery[];
      error?: string;
    };
    if (!res.ok) throw new Error(data.error || "Could not load runs.");
    setRuns(data.runs ?? []);
    setDeliveries(data.deliveries ?? []);
  }

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || runs) return;
    try {
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load runs.");
    }
  }

  async function rerun(rowId: string) {
    setBusyRow(rowId);
    setError("");
    try {
      const res = await fetch(`/api/forms/workflows/${workflowId}/rerun`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not run again.");
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run again.");
    } finally {
      setBusyRow(null);
    }
  }

  return (
    <div className="mt-1.5 border-t border-[color:var(--wsu-border)]/80 pt-1.5">
      <button
        type="button"
        className="text-xs font-medium text-[color:var(--wsu-crimson)]"
        onClick={() => void toggle()}
        aria-expanded={open}
      >
        {open ? "Hide runs" : "Runs"}
      </button>
      {open ? (
        <div className="mt-2">
          {error ? <p className="text-xs text-[color:var(--product-err)]">{error}</p> : null}
          {!runs ? <p className="text-xs text-[color:var(--wsu-muted)]">Loading runs…</p> : null}
          {runs && !runs.length ? <p className="text-xs text-[color:var(--wsu-muted)]">No runs yet.</p> : null}
          {runs && runs.length ? (
            <div
              className="max-h-64 space-y-2 overflow-y-auto overscroll-contain pr-1"
              tabIndex={0}
              role="region"
              aria-label="Workflow runs"
            >
              {runs.map((run) => {
                const lines = deliveries.filter((delivery) => delivery.runId === run.id);
                return (
                  <div key={run.id} className="rounded-lg bg-[color:var(--wsu-stone)]/70 px-2.5 py-2 text-xs text-[color:var(--wsu-ink)]">
                    <p className="font-medium">
                      {retryLabel(run)}
                      {run.rowId ? ` · row ${run.rowId}` : ""}
                      {` · ${run.source}`}
                    </p>
                    {run.error ? <p className="mt-1 text-[color:var(--product-err)]">{run.error}</p> : null}
                    {lines.length ? (
                      <ul className="mt-1 space-y-0.5 text-[color:var(--wsu-muted)]">
                        {lines.map((line) => (
                          <li key={line.id}>
                            {line.channel} · {line.recipientEmail} ·{" "}
                            {line.channel === "email" ? (
                              <button
                                type="button"
                                className="font-medium text-[color:var(--wsu-crimson)] underline"
                                onClick={() => setTrace(line)}
                              >
                                {line.status === "pending" ? "waiting for SES" : line.status}
                              </button>
                            ) : (
                              line.status
                            )}
                            {line.error ? ` · ${line.error}` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {run.rowId ? (
                      <button
                        type="button"
                        className={`${rowActionClass} mt-2 border border-[color:var(--wsu-border)] bg-white`}
                        disabled={busyRow === run.rowId}
                        onClick={() => void rerun(run.rowId!)}
                      >
                        {busyRow === run.rowId ? "Running…" : "Run again"}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
      <EmailTraceDrawer delivery={trace} onClose={() => setTrace(null)} />
    </div>
  );
}
