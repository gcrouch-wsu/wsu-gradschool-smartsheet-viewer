"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { IconRefresh, IconSearch } from "@/components/forms/icons";
import { SubmissionCard } from "@/components/forms/tracker/SubmissionCard";
import type {
  TimelineItem,
  TrackerAttachment,
  TrackerDiscussion,
  TrackerSubmission,
} from "@/components/forms/tracker/useSubmissionTracker";

type StatusFilter = "all" | "current" | "complete" | "declined";

interface SubmissionTrackerViewProps {
  subs: TrackerSubmission[];
  sheetName: string;
  demo: boolean;
  roles: string[];
  workflowStages: string[];
  error: string;
  refreshing: boolean;
  timelines: Record<number, TimelineItem[] | "loading" | "hidden">;
  attachments: Record<number, TrackerAttachment[] | "loading">;
  discussions: Record<number, TrackerDiscussion[] | "loading">;
  commentText: Record<number, string>;
  actionBusy: number | null;
  onRefresh: () => void;
  onToggleTimeline: (rowId: number) => void;
  onLoadExtras: (rowId: number) => void;
  onApprove: (rowId: number) => void;
  onDecline: (rowId: number) => void;
  onDelete: (rowId: number) => void;
  onCommentChange: (rowId: number, text: string) => void;
  onPostComment: (rowId: number) => void;
}

function shortStageName(title: string) {
  return title.replace(/\s*status$/i, "").replace(/\s*approval$/i, "").trim();
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--wsu-border)] bg-white px-4 py-3">
      <p className="text-xs text-[color:var(--wsu-muted)]">{label}</p>
      <p className={`mt-1 text-2xl font-medium leading-none ${tone ?? "text-[color:var(--wsu-ink)]"}`}>{value}</p>
    </div>
  );
}

export function SubmissionTrackerView({
  subs,
  sheetName,
  demo,
  roles,
  workflowStages,
  error,
  refreshing,
  timelines,
  attachments,
  discussions,
  commentText,
  actionBusy,
  onRefresh,
  onToggleTimeline,
  onLoadExtras,
  onApprove,
  onDecline,
  onDelete,
  onCommentChange,
  onPostComment,
}: SubmissionTrackerViewProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const metrics = useMemo(() => {
    let inReview = 0;
    let complete = 0;
    let declined = 0;
    for (const s of subs) {
      const st = s.approvalStatus?.state;
      if (st === "current") inReview++;
      else if (st === "complete") complete++;
      else if (st === "declined") declined++;
    }
    return { total: subs.length, inReview, complete, declined };
  }, [subs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return subs.filter((s) => {
      if (statusFilter !== "all" && s.approvalStatus?.state !== statusFilter) return false;
      if (!q) return true;
      return (
        s.label.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.overall.toLowerCase().includes(q) ||
        (s.approvalStatus?.label ?? "").toLowerCase().includes(q)
      );
    });
  }, [subs, query, statusFilter]);

  const filterPill = (id: StatusFilter, label: string) => {
    const active = statusFilter === id;
    return (
      <button
        type="button"
        onClick={() => setStatusFilter(id)}
        className={[
          "rounded-full px-3 py-1 text-xs font-medium transition-colors",
          active
            ? "bg-wsu-crimson text-white"
            : "border border-[color:var(--wsu-border)] bg-white text-[color:var(--wsu-muted)] hover:bg-[color:var(--wsu-stone)]",
        ].join(" ")}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-[color:var(--wsu-ink)]">Submission tracker</h1>
          <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">
            {demo ? "Demo" : "Live"} · {sheetName || "Active sheet"}
            {workflowStages.length ? ` · ${workflowStages.length} approval stages` : ""}
            {" · "}Auto-refreshes every 30s
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm font-medium text-[color:var(--wsu-ink)] hover:bg-[color:var(--wsu-stone)] disabled:opacity-50"
          >
            <IconRefresh className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            href="/forms/sheet"
            className="rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm font-medium text-[color:var(--wsu-ink)] hover:bg-[color:var(--wsu-stone)]"
          >
            Open grid
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Total" value={metrics.total} />
        <MetricCard label="In review" value={metrics.inReview} tone="text-amber-700" />
        <MetricCard label="Complete" value={metrics.complete} tone="text-emerald-700" />
        <MetricCard label="Declined" value={metrics.declined} tone="text-red-700" />
      </div>

      {workflowStages.length > 0 ? (
        <div className="rounded-xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--wsu-muted)]">Approval chain</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {workflowStages.map((name, i) => (
              <span key={name} className="inline-flex items-center gap-1.5 text-sm text-[color:var(--wsu-muted)]">
                {i > 0 ? <span className="text-[color:var(--wsu-border)]">→</span> : null}
                <span className="rounded-md bg-white px-2 py-0.5 text-xs font-medium text-wsu-crimson ring-1 ring-[color:var(--wsu-border)]">
                  {shortStageName(name)}
                </span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[color:var(--wsu-border)] bg-white px-4 py-3">
        <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--wsu-muted)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search submissions…"
            aria-label="Search submissions"
            className="w-full rounded-lg border border-[color:var(--wsu-border)] py-2 pl-9 pr-3 text-sm focus:border-wsu-crimson focus:outline-none focus:ring-1 focus:ring-wsu-crimson"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {filterPill("all", "All")}
          {filterPill("current", "In review")}
          {filterPill("complete", "Complete")}
          {filterPill("declined", "Declined")}
        </div>
      </div>

      {subs.length === 0 ? (
        <div className="rounded-xl border border-[color:var(--wsu-border)] bg-white px-6 py-12 text-center">
          <p className="text-sm text-[color:var(--wsu-muted)]">
            No submissions yet. Publish a form from Manage to collect responses via its public URL.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-[color:var(--wsu-border)] bg-white px-6 py-12 text-center">
          <p className="text-sm text-[color:var(--wsu-muted)]">No submissions match your filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((s) => (
            <SubmissionCard
              key={s.rowId}
              submission={s}
              roles={roles}
              actionBusy={actionBusy}
              timeline={timelines[s.rowId]}
              attachments={attachments[s.rowId]}
              discussions={discussions[s.rowId]}
              commentText={commentText[s.rowId] ?? ""}
              onToggleTimeline={() => onToggleTimeline(s.rowId)}
              onLoadExtras={() => onLoadExtras(s.rowId)}
              onApprove={() => onApprove(s.rowId)}
              onDecline={() => onDecline(s.rowId)}
              onDelete={() => onDelete(s.rowId)}
              onCommentChange={(text) => onCommentChange(s.rowId, text)}
              onPostComment={() => onPostComment(s.rowId)}
            />
          ))}
        </div>
      )}

      {subs.length > 0 ? (
        <p className="text-xs text-[color:var(--wsu-muted)]">
          Showing {filtered.length} of {subs.length} submission{subs.length === 1 ? "" : "s"}
          {query ? ` · search “${query}”` : ""}
        </p>
      ) : null}
    </div>
  );
}
