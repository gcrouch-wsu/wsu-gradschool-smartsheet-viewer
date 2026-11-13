"use client";

import { useState } from "react";
import type { WorkflowDeliveryRecord, WorkflowRecord, WorkflowRunRecord } from "@/lib/workflows/types";
import { workflowSecondaryBtnClass } from "@/components/workflows/shared";

function retryLabel(run: WorkflowRunRecord): string {
  if (run.status !== "failed") return run.status;
  if (!run.nextRetryAt) return `Failed after ${run.attemptCount} attempts`;
  const when = new Date(run.nextRetryAt);
  const remaining = when.getTime() - Date.now();
  if (remaining <= 0) return "Failed · retrying now";
  const seconds = Math.ceil(remaining / 1000);
  return `Failed · retries in ${seconds}s`;
}

export function WorkflowList({
  workflows,
  failures,
  onEdit,
  onPreview,
  onDelete,
  onChanged,
}: {
  workflows: WorkflowRecord[];
  failures: WorkflowRunRecord[];
  onEdit: (workflow: WorkflowRecord) => void;
  onPreview: (id: string) => void;
  onDelete: (id: string) => void;
  onChanged: () => void;
}) {
  const failureByWorkflow = new Map(failures.map((run) => [run.workflowId, run]));

  if (!workflows.length) {
    return (
      <p className="rounded-2xl border border-dashed border-[color:var(--wsu-border)] bg-white px-4 py-10 text-center text-sm text-[color:var(--wsu-muted)]">
        No workflows yet. Choose a template above to configure one on this page.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {workflows.map((workflow) => {
        const failure = failureByWorkflow.get(workflow.id);
        return (
          <li
            key={workflow.id}
            className="rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-3 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[color:var(--wsu-ink)]">{workflow.name}</p>
                <p className="mt-0.5 text-xs text-[color:var(--wsu-muted)]">
                  {workflow.templateKind}
                  {workflow.createdByEmail ? ` · ${workflow.createdByEmail}` : ""}
                </p>
                {failure?.error ? (
                  <p className="mt-1 text-xs text-red-800">{failure.error}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    failure
                      ? "bg-red-50 text-red-800"
                      : workflow.enabled
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-[color:var(--wsu-stone)] text-[color:var(--wsu-muted)]"
                  }`}
                >
                  {failure ? retryLabel(failure) : workflow.enabled ? "Enabled" : "Off"}
                </span>
                <button type="button" className={workflowSecondaryBtnClass} onClick={() => onEdit(workflow)}>
                  Edit
                </button>
                {workflow.templateKind === "alert" && workflow.id ? (
                  <button type="button" className={workflowSecondaryBtnClass} onClick={() => onPreview(workflow.id)}>
                    Send preview
                  </button>
                ) : null}
                <button type="button" className={workflowSecondaryBtnClass} onClick={() => onDelete(workflow.id)}>
                  Delete
                </button>
              </div>
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
  const [deliveries, setDeliveries] = useState<WorkflowDeliveryRecord[]>([]);
  const [error, setError] = useState("");
  const [busyRow, setBusyRow] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/forms/workflows/${workflowId}/runs`, { cache: "no-store" });
    const data = (await res.json()) as {
      runs?: WorkflowRunRecord[];
      deliveries?: WorkflowDeliveryRecord[];
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
    <div className="mt-3 border-t border-[color:var(--wsu-border)] pt-2">
      <button type="button" className="text-xs font-medium text-[color:var(--wsu-crimson)]" onClick={() => void toggle()} aria-expanded={open}>
        {open ? "Hide runs" : "Runs"}
      </button>
      {open ? (
        <div className="mt-2 space-y-2">
          {error ? <p className="text-xs text-red-800">{error}</p> : null}
          {!runs ? <p className="text-xs text-[color:var(--wsu-muted)]">Loading runs…</p> : null}
          {runs && !runs.length ? <p className="text-xs text-[color:var(--wsu-muted)]">No runs yet.</p> : null}
          {runs?.map((run) => {
            const lines = deliveries.filter((delivery) => delivery.runId === run.id);
            return (
              <div key={run.id} className="rounded-xl bg-[color:var(--wsu-stone)]/40 px-3 py-2 text-xs text-[color:var(--wsu-ink)]">
                <p className="font-medium">
                  {retryLabel(run)}
                  {run.rowId ? ` · row ${run.rowId}` : ""}
                  {` · ${run.source}`}
                </p>
                {run.error ? <p className="mt-1 text-red-800">{run.error}</p> : null}
                {lines.length ? (
                  <ul className="mt-1 space-y-0.5 text-[color:var(--wsu-muted)]">
                    {lines.map((line) => (
                      <li key={line.id}>
                        {line.channel} · {line.recipientEmail} · {line.status}
                        {line.error ? ` · ${line.error}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {run.rowId ? (
                  <button
                    type="button"
                    className={`${workflowSecondaryBtnClass} mt-2`}
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
  );
}
