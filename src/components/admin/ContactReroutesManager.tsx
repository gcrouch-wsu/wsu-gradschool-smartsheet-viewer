"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ADMIN_TABLE_PAGE_SIZE,
  AdminDataTable,
  resolveAdminTablePage,
} from "@/components/admin/AdminDataTable";
import { Button, EmptyState } from "@/components/admin/WorkspacePrimitives";
import { IconCheck, IconX } from "@/components/forms/icons";
import { useToast } from "@/components/ui/Toast";
import type { ContactChangeRequest } from "@/lib/forms/store/contact-change-requests";

type StatusFilter = "pending" | "approved" | "rejected" | "all";

function formatWhen(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function reroutesBasePath(status: StatusFilter, query: string): string {
  const params = new URLSearchParams();
  if (status !== "pending") params.set("status", status);
  const trimmed = query.trim();
  if (trimmed) params.set("q", trimmed);
  const qs = params.toString();
  return qs ? `/admin/reroutes?${qs}` : "/admin/reroutes";
}

export function ContactReroutesManager({
  page: initialPage = 1,
  query: initialQuery = "",
  status: initialStatus = "pending",
}: {
  page?: number;
  query?: string;
  status?: StatusFilter;
}) {
  const router = useRouter();
  const toast = useToast();
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const [query, setQuery] = useState(initialQuery);
  const [requests, setRequests] = useState<ContactChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/forms/contact-change-requests?status=${encodeURIComponent(initialStatus)}`);
      const d = (await r.json().catch(() => null)) as {
        requests?: ContactChangeRequest[];
        error?: string;
        message?: string;
      } | null;
      if (!r.ok) {
        throw new Error(d?.error || d?.message || "Could not load reroute requests.");
      }
      setRequests(Array.isArray(d?.requests) ? d.requests : []);
    } catch (e: unknown) {
      setRequests([]);
      setError(e instanceof Error ? e.message : "Could not load reroute requests.");
    } finally {
      setLoading(false);
    }
  }, [initialStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRequests = useMemo(() => {
    const q = initialQuery.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((req) => {
      const haystack = [
        req.requestedBy.name,
        req.requestedBy.email,
        req.sheetName,
        req.sheetId,
        req.stageTitle,
        req.proposedName,
        req.proposedEmail,
        req.note,
        String(req.rowId),
        req.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [requests, initialQuery]);

  const page = resolveAdminTablePage(String(initialPage), filteredRequests.length);
  const basePath = reroutesBasePath(initialStatus, initialQuery);

  function applySearch(event: React.FormEvent) {
    event.preventDefault();
    router.push(reroutesBasePath(initialStatus, query));
  }

  function changeStatus(next: StatusFilter) {
    setStatus(next);
    router.push(reroutesBasePath(next, initialQuery));
  }

  async function act(id: string, action: "approve" | "reject") {
    setBusyId(id);
    try {
      const r = await fetch(`/api/forms/contact-change-requests/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const d = (await r.json().catch(() => null)) as { message?: string; error?: string } | null;
      if (!r.ok) {
        throw new Error(d?.error || d?.message || `${action} failed.`);
      }
      toast.addToast(d?.message || (action === "approve" ? "Approved." : "Rejected."), "success");
      await load();
    } catch (e: unknown) {
      toast.addToast(e instanceof Error ? e.message : `${action} failed.`, "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={applySearch} className="flex flex-wrap items-center gap-2">
        <label className="relative block min-w-[14rem] max-w-md flex-1">
          <span className="sr-only">Search reroutes</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, email, sheet, stage…"
            className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-crimson focus:ring-1 focus:ring-crimson"
          />
        </label>
        <Button type="submit">Search</Button>
        {query.trim() ? (
          <Button
            type="button"
            onClick={() => {
              setQuery("");
              router.push(reroutesBasePath(initialStatus, ""));
            }}
          >
            Clear
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
        <span className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-sub">
          {filteredRequests.length} request{filteredRequests.length === 1 ? "" : "s"}
        </span>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        {(["pending", "approved", "rejected", "all"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => changeStatus(s)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition ${
              status === s
                ? "border-crimson bg-[var(--crimson-soft)] text-crimson"
                : "border-line bg-white text-sub hover:border-mist"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {error ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-sub">Loading…</p>
      ) : (
        <AdminDataTable
          headers={["Requested", "Submission", "Stage", "Change", "Status", "Actions"]}
          items={filteredRequests}
          page={page}
          basePath={basePath}
          pageSize={ADMIN_TABLE_PAGE_SIZE}
          columns={6}
          endAlignLastHeader
          getRowKey={(req) => req.id}
          empty={
            <EmptyState
              icon={<span className="text-sm font-semibold">R</span>}
              title={
                initialQuery.trim()
                  ? "No reroutes match your search"
                  : `No ${initialStatus === "all" ? "" : `${initialStatus} `}reroute requests`
              }
              description={
                initialQuery.trim()
                  ? "Try a different name, email, sheet, or stage."
                  : "Staff can propose contact changes from a submission detail. Until Programs Team approves, the sheet and Smartsheet notifications stay unchanged."
              }
              variant="panel"
            />
          }
          renderRow={(req) => {
            const prev =
              [
                req.fields.find((f) => f.previousName)?.previousName,
                req.fields.find((f) => f.previousEmail)?.previousEmail,
              ]
                .filter(Boolean)
                .join(" · ") ||
              req.fields.map((f) => f.previousDisplay).filter(Boolean).join(" · ") ||
              "—";
            const next = [req.proposedName, req.proposedEmail].filter(Boolean).join(" · ");

            return (
              <>
                <div className="min-w-0">
                  <p className="font-medium text-ink">{req.requestedBy.name}</p>
                  <p className="mt-1 text-xs text-sub">{formatWhen(req.requestedAt)}</p>
                  {req.note ? <p className="mt-1 text-xs text-sub">{req.note}</p> : null}
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-ink">{req.sheetName || req.sheetId}</p>
                  <p className="mt-1 text-xs text-sub">Row {req.rowId}</p>
                  <Link
                    href={`/forms/sheet?sheetId=${encodeURIComponent(req.sheetId)}&rowId=${req.rowId}`}
                    className="mt-1 inline-block text-xs font-medium text-crimson hover:underline"
                  >
                    Open sheet
                  </Link>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-ink">{req.stageTitle}</p>
                  <p className={`mt-1 text-xs ${req.isCurrentStage ? "text-amber-800" : "text-sub"}`}>
                    {req.isCurrentStage ? "Current pending stage" : "Future stage"}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-sub">From: {prev}</p>
                  <p className="mt-0.5 text-sm font-medium text-ink">To: {next}</p>
                </div>
                <p className="min-w-0 text-sm capitalize text-sub">{req.status}</p>
                <div className="flex flex-nowrap items-center gap-2 sm:justify-end">
                  {req.status === "pending" ? (
                    <>
                      <button
                        type="button"
                        title="Approve"
                        aria-label="Approve"
                        disabled={busyId === req.id}
                        onClick={() => void act(req.id, "approve")}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-crimson bg-crimson text-white transition hover:border-[var(--crimson-deep)] hover:bg-[var(--crimson-deep)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <IconCheck className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Reject"
                        aria-label="Reject"
                        disabled={busyId === req.id}
                        onClick={() => void act(req.id, "reject")}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line-strong bg-white text-crimson transition hover:border-crimson hover:bg-[var(--crimson-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <IconX className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-sub sm:text-right">
                      {req.reviewedBy?.name ? `By ${req.reviewedBy.name}` : "—"}
                      {req.reviewedAt ? ` · ${formatWhen(req.reviewedAt)}` : ""}
                    </span>
                  )}
                </div>
              </>
            );
          }}
        />
      )}
    </div>
  );
}
