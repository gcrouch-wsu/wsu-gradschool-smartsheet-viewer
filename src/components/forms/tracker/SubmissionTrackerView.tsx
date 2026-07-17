"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { IconCheck, IconFile, IconRefresh, IconSearch } from "@/components/forms/icons";
import type {
  TimelineItem,
  TrackerAttachment,
  TrackerDiscussion,
  TrackerStep,
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

function canApprove(roles: string[]) {
  return roles.includes("admin") || roles.includes("approver");
}

function isAdmin(roles: string[]) {
  return roles.includes("admin");
}

function shortStageName(title: string) {
  return title.replace(/\s*status$/i, "").replace(/\s*approval$/i, "").trim();
}

function overallBadgeClass(overall: string) {
  if (/complete|approved|done/i.test(overall)) {
    return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  }
  if (/declin|reject|denied/i.test(overall)) {
    return "bg-red-50 text-red-800 ring-red-200";
  }
  return "bg-[color:var(--wsu-stone)] text-[color:var(--wsu-muted)] ring-[color:var(--wsu-border)]";
}

function statusBannerClass(state: TrackerSubmission["approvalStatus"]["state"]) {
  switch (state) {
    case "complete":
      return "border-emerald-200 bg-emerald-50/80";
    case "declined":
      return "border-red-200 bg-red-50/80";
    case "current":
      return "border-amber-200 bg-amber-50/80";
    default:
      return "border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/60";
  }
}

function statusTextClass(state: TrackerSubmission["approvalStatus"]["state"]) {
  switch (state) {
    case "complete":
      return "text-emerald-900";
    case "declined":
      return "text-red-900";
    case "current":
      return "text-amber-950";
    default:
      return "text-[color:var(--wsu-ink)]";
  }
}

function stepStyles(display: TrackerStep["display"]) {
  switch (display) {
    case "done":
      return {
        dot: "border-emerald-500 bg-emerald-500 text-white",
        label: "text-emerald-800",
        value: "text-emerald-700",
        line: "bg-emerald-300",
      };
    case "declined":
      return {
        dot: "border-red-500 bg-red-500 text-white",
        label: "text-red-800",
        value: "text-red-700",
        line: "bg-red-200",
      };
    case "current":
      return {
        dot: "border-wsu-crimson bg-white text-wsu-crimson ring-4 ring-wsu-crimson/15",
        label: "text-wsu-crimson font-medium",
        value: "text-[color:var(--wsu-ink)] font-medium",
        line: "bg-[color:var(--wsu-border)]",
      };
    default:
      return {
        dot: "border-[color:var(--wsu-border)] bg-white text-[color:var(--wsu-muted)]",
        label: "text-[color:var(--wsu-muted)]",
        value: "text-[color:var(--wsu-muted)]",
        line: "bg-[color:var(--wsu-border)]",
      };
  }
}

function StepIcon({ display }: { display: TrackerStep["display"] }) {
  if (display === "done") return <IconCheck className="h-3.5 w-3.5" />;
  if (display === "declined") {
    return (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
      </svg>
    );
  }
  if (display === "current") {
    return <span className="h-2 w-2 rounded-full bg-wsu-crimson" />;
  }
  return <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--wsu-border)]" />;
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--wsu-border)] bg-white px-4 py-3">
      <p className="text-xs text-[color:var(--wsu-muted)]">{label}</p>
      <p className={`mt-1 text-2xl font-medium leading-none ${tone ?? "text-[color:var(--wsu-ink)]"}`}>{value}</p>
    </div>
  );
}

function SubmissionCard({
  submission,
  roles,
  actionBusy,
  timeline,
  attachments,
  discussions,
  commentText,
  onToggleTimeline,
  onLoadExtras,
  onApprove,
  onDecline,
  onDelete,
  onCommentChange,
  onPostComment,
}: {
  submission: TrackerSubmission;
  roles: string[];
  actionBusy: number | null;
  timeline: TimelineItem[] | "loading" | "hidden" | undefined;
  attachments: TrackerAttachment[] | "loading" | undefined;
  discussions: TrackerDiscussion[] | "loading" | undefined;
  commentText: string;
  onToggleTimeline: () => void;
  onLoadExtras: () => void;
  onApprove: () => void;
  onDecline: () => void;
  onDelete: () => void;
  onCommentChange: (text: string) => void;
  onPostComment: () => void;
}) {
  const [extrasOpen, setExtrasOpen] = useState(false);
  const approver = canApprove(roles);
  const admin = isAdmin(roles);
  const busy = actionBusy === submission.rowId;
  const showActions = approver && submission.approvalStatus?.state === "current";
  const state = submission.approvalStatus?.state ?? "not-started";

  const meta = [
    submission.email,
    submission.createdAt ? new Date(submission.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" }) : "",
  ]
    .filter(Boolean)
    .join(" · ");

  function handleExtras() {
    setExtrasOpen(true);
    onLoadExtras();
  }

  const allComments = Array.isArray(discussions)
    ? discussions.flatMap((d) => d.comments ?? [])
    : [];

  return (
    <article className="overflow-hidden rounded-xl border border-[color:var(--wsu-border)] bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[color:var(--wsu-border)] px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-medium text-[color:var(--wsu-ink)]">{submission.label}</h2>
          {meta ? <p className="mt-0.5 text-sm text-[color:var(--wsu-muted)]">{meta}</p> : null}
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${overallBadgeClass(submission.overall)}`}
        >
          {submission.overall}
        </span>
      </div>

      <div className={`mx-5 mt-4 rounded-lg border px-4 py-3 ${statusBannerClass(state)}`}>
        <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--wsu-muted)]">Approval status</p>
        <p className={`mt-1 text-sm ${statusTextClass(state)}`}>
          <span className="font-medium">{submission.approvalStatus?.label ?? "In review"}</span>
          {submission.approvalStatus?.value && state === "current" ? (
            <span className="text-[color:var(--wsu-muted)]"> · {submission.approvalStatus.value}</span>
          ) : null}
        </p>
      </div>

      {(showActions || admin) && (
        <div className="flex flex-wrap gap-2 px-5 pt-4">
          {showActions ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={onApprove}
                className="inline-flex items-center gap-1.5 rounded-lg bg-wsu-crimson px-3 py-1.5 text-sm font-medium text-white hover:bg-wsu-crimson/90 disabled:opacity-50"
              >
                <IconCheck className="h-4 w-4" />
                Approve
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onDecline}
                className="rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-1.5 text-sm font-medium text-[color:var(--wsu-ink)] hover:bg-[color:var(--wsu-stone)] disabled:opacity-50"
              >
                Decline
              </button>
            </>
          ) : null}
          {admin ? (
            <button
              type="button"
              disabled={busy}
              onClick={onDelete}
              className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
          ) : null}
        </div>
      )}

      {submission.stages.length > 0 ? (
        <div className="mt-5 overflow-x-auto px-5 pb-2">
          <ol className="flex min-w-max items-start gap-0">
            {submission.stages.map((step, i) => {
              const styles = stepStyles(step.display);
              const isLast = i === submission.stages.length - 1;
              return (
                <li key={step.name} className="flex items-start">
                  <div className="flex w-[7.5rem] flex-col items-center px-1 text-center sm:w-[8.5rem]">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs ${styles.dot}`}
                    >
                      <StepIcon display={step.display} />
                    </div>
                    <p className={`mt-2 line-clamp-2 text-xs leading-tight ${styles.label}`}>
                      {shortStageName(step.name)}
                    </p>
                    <p className={`mt-1 line-clamp-2 text-[11px] ${styles.value}`}>{step.value || "—"}</p>
                  </div>
                  {!isLast ? (
                    <div className={`mt-4 h-0.5 w-6 shrink-0 sm:w-10 ${styles.line}`} aria-hidden />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/40 px-5 py-3">
        <button
          type="button"
          onClick={onToggleTimeline}
          disabled={timeline === "loading"}
          className="rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-1.5 text-xs font-medium text-[color:var(--wsu-ink)] hover:bg-[color:var(--wsu-stone)] disabled:opacity-50"
        >
          {timeline === "loading" ? "Loading timeline…" : Array.isArray(timeline) ? "Hide timeline" : "Show timeline"}
        </button>
        <button
          type="button"
          onClick={handleExtras}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-1.5 text-xs font-medium text-[color:var(--wsu-ink)] hover:bg-[color:var(--wsu-stone)]"
        >
          <IconFile className="h-3.5 w-3.5" />
          Files & notes
        </button>
      </div>

      {Array.isArray(timeline) ? (
        <div className="border-t border-[color:var(--wsu-border)] px-5 py-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-[color:var(--wsu-muted)]">Decision timeline</h3>
          {timeline.length === 0 ? (
            <p className="mt-2 text-sm text-[color:var(--wsu-muted)]">No recorded decisions yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {timeline.map((item) => (
                <li key={item.name} className="flex gap-3 text-sm">
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-wsu-crimson" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[color:var(--wsu-ink)]">
                      {shortStageName(item.name)}
                      <span className="font-normal text-[color:var(--wsu-muted)]"> · {item.value}</span>
                    </p>
                    <p className="text-xs text-[color:var(--wsu-muted)]">
                      {item.at ? new Date(item.at).toLocaleString() : "Date unknown"}
                      {item.by ? ` · ${item.by}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {extrasOpen ? (
        <div className="border-t border-[color:var(--wsu-border)] px-5 py-4">
          {attachments === "loading" || discussions === "loading" ? (
            <p className="text-sm text-[color:var(--wsu-muted)]">Loading files & notes…</p>
          ) : null}

          {Array.isArray(attachments) && attachments.length > 0 ? (
            <div className="mb-4">
              <h3 className="text-xs font-medium uppercase tracking-wide text-[color:var(--wsu-muted)]">Attachments</h3>
              <ul className="mt-2 space-y-1">
                {attachments.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-sm text-[color:var(--wsu-ink)]">
                    <IconFile className="h-4 w-4 shrink-0 text-[color:var(--wsu-muted)]" />
                    {a.name}
                  </li>
                ))}
              </ul>
            </div>
          ) : Array.isArray(attachments) ? (
            <p className="mb-4 text-sm text-[color:var(--wsu-muted)]">No attachments.</p>
          ) : null}

          {Array.isArray(discussions) ? (
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-[color:var(--wsu-muted)]">Discussion</h3>
              {allComments.length === 0 ? (
                <p className="mt-2 text-sm text-[color:var(--wsu-muted)]">No comments yet.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {allComments.map((c, i) => (
                    <li key={i} className="rounded-lg bg-[color:var(--wsu-stone)]/80 px-3 py-2 text-sm">
                      <p className="text-[color:var(--wsu-ink)]">{c.text}</p>
                      <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">
                        {c.createdBy?.name ?? "Unknown"}
                        {c.createdAt ? ` · ${new Date(c.createdAt).toLocaleString()}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {approver ? (
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    placeholder="Add a note…"
                    value={commentText}
                    onChange={(e) => onCommentChange(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onPostComment()}
                    className="min-w-0 flex-1 rounded-lg border border-[color:var(--wsu-border)] px-3 py-2 text-sm focus:border-wsu-crimson focus:outline-none focus:ring-1 focus:ring-wsu-crimson"
                  />
                  <button
                    type="button"
                    onClick={onPostComment}
                    className="shrink-0 rounded-lg bg-wsu-crimson px-3 py-2 text-sm font-medium text-white hover:bg-wsu-crimson/90"
                  >
                    Post
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
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
