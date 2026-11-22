"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { EmptyState } from "@/components/admin/WorkspacePrimitives";
import { MAX_RUN_ATTEMPTS } from "@/lib/workflows/retry-policy";
import type { ActivityFailedRun } from "@/lib/workflows/activity-failures";

function retryText(run: ActivityFailedRun): string {
  if (!run.nextRetryAt) return `Stopped after ${run.attemptCount} of ${MAX_RUN_ATTEMPTS} attempts`;
  const remaining = new Date(run.nextRetryAt).getTime() - Date.now();
  if (remaining <= 0) return `Retrying now · attempt ${run.attemptCount} of ${MAX_RUN_ATTEMPTS}`;
  const seconds = Math.max(1, Math.ceil(remaining / 1000));
  return `Retries in ${seconds}s · attempt ${run.attemptCount} of ${MAX_RUN_ATTEMPTS}`;
}

export function FailedRunsPanel({
  runs,
  page,
  available,
}: {
  runs: ActivityFailedRun[];
  page: number;
  available: boolean;
}) {
  const [rows, setRows] = useState(runs);
  const [dbAvailable, setDbAvailable] = useState(available);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");

  useEffect(() => {
    setRows(runs);
    setDbAvailable(available);
  }, [runs, available]);

  async function refreshRuns() {
    setRefreshing(true);
    setRefreshError("");
    try {
      const response = await fetch("/api/admin/workflow-failures", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not refresh failed runs.");
      const data = (await response.json()) as { available: boolean; runs: ActivityFailedRun[] };
      setRows(data.runs);
      setDbAvailable(data.available);
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "Could not refresh failed runs.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-sub">
          A failed run stays here and tries again after 60 seconds, up to three times. After the third attempt it stays failed.
        </p>
        <button
          type="button"
          onClick={() => void refreshRuns()}
          disabled={refreshing}
          className="rounded-lg border border-line-strong bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-[#faf7f8] disabled:opacity-60"
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {refreshError ? (
        <p role="status" className="text-sm text-crimson">
          {refreshError}
        </p>
      ) : null}
      {!dbAvailable ? (
        <p className="rounded-xl border border-line bg-[#fdfbfc] px-4 py-3 text-sm text-sub">
          Failed runs are stored in Postgres. Set DATABASE_URL to record them.
        </p>
      ) : null}
      <AdminDataTable
        headers={["When", "Workflow", "Retry", "Error"]}
        items={rows}
        page={page}
        basePath="/admin/activity?tab=runs"
        getRowKey={(run) => run.id}
        empty={
          <EmptyState
            icon={<span className="font-serif text-lg">!</span>}
            title="No failed runs"
            description="When a workflow fails, it appears here with the error and the next retry."
            variant="panel"
          />
        }
        renderRow={(run) => (
          <>
            <p className="min-w-0 text-sm text-sub">{new Date(run.createdAt).toLocaleString()}</p>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{run.workflowName}</p>
              <p className="mt-1 text-xs text-mist">
                {run.rowId ? `Row ${run.rowId}` : "No row"}
                {run.workflowHref ? (
                  <>
                    {" · "}
                    <Link href={run.workflowHref} className="font-medium text-crimson hover:underline">
                      Open workflow
                    </Link>
                  </>
                ) : null}
              </p>
            </div>
            <p className="min-w-0 text-sm text-ink">{retryText(run)}</p>
            <p className="min-w-0 text-sm text-ink">{run.error || "No error message was recorded."}</p>
          </>
        )}
      />
    </div>
  );
}
