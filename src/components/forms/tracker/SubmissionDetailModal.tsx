"use client";

import { useCallback, useEffect, useState } from "react";
import { SubmissionCard } from "@/components/forms/tracker/SubmissionCard";
import { RerouteApproverPanel } from "@/components/forms/tracker/RerouteApproverPanel";
import type {
  ContactChangeLogItem,
  TimelineItem,
  TrackerAttachment,
  TrackerDiscussion,
  TrackerSubmission,
} from "@/components/forms/tracker/types";
import { Modal } from "@/components/ui/Modal";

async function parseApiJson(r: Response): Promise<Record<string, unknown>> {
  const text = await r.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(r.ok ? "Invalid response from server." : text.slice(0, 120) || `Request failed (${r.status}).`);
  }
}

function withSheetId(path: string, sheetId?: string | null): string {
  if (!sheetId) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}sheetId=${encodeURIComponent(sheetId)}`;
}

interface SubmissionDetailModalProps {
  rowId: number | null;
  /** When set, row APIs target this form sheet instead of the global active sheet. */
  sheetId?: string | null;
  open: boolean;
  onClose: () => void;
  /** Called after resend so the parent (e.g. grid) can refresh. */
  onChanged?: () => void;
}

export function SubmissionDetailModal({
  rowId,
  sheetId,
  open,
  onClose,
  onChanged,
}: SubmissionDetailModalProps) {
  const [submission, setSubmission] = useState<TrackerSubmission | null>(null);
  const [roles, setRoles] = useState<string[]>(["viewer"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState<number | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[] | "loading" | "hidden">("hidden");
  const [contactChanges, setContactChanges] = useState<ContactChangeLogItem[] | "loading" | "hidden">("hidden");
  const [attachments, setAttachments] = useState<TrackerAttachment[] | "loading" | undefined>(undefined);
  const [discussions, setDiscussions] = useState<TrackerDiscussion[] | "loading" | undefined>(undefined);
  const [commentText, setCommentText] = useState("");
  const [canResend, setCanResend] = useState(false);
  const [resendHint, setResendHint] = useState<string | null>(null);
  const [resendColumnTitle, setResendColumnTitle] = useState<string | null>(null);

  const loadSubmission = useCallback(
    async (id: number) => {
      setLoading(true);
      setError("");
      try {
        const r = await fetch(withSheetId(`/api/forms/submissions/${id}`, sheetId));
        const d = await parseApiJson(r);
        if (!r.ok) {
          throw new Error(
            (typeof d.error === "string" && d.error) ||
              (typeof d.message === "string" && d.message) ||
              "Could not load submission.",
          );
        }
        setSubmission((d.submission as TrackerSubmission) ?? null);
        setRoles(Array.isArray(d.roles) ? (d.roles as string[]) : ["viewer"]);
        const resend = d.resend as
          | { available?: boolean; columnTitle?: string | null; recipientEmail?: string | null }
          | undefined;
        setCanResend(Boolean(resend?.available));
        setResendColumnTitle(typeof resend?.columnTitle === "string" ? resend.columnTitle : null);
        setResendHint(typeof resend?.recipientEmail === "string" ? resend.recipientEmail : null);
        if (!d.submission) setError("Submission not found.");
      } catch (e: unknown) {
        setSubmission(null);
        setCanResend(false);
        setResendHint(null);
        setResendColumnTitle(null);
        setError(e instanceof Error ? e.message : "Could not load submission.");
      } finally {
        setLoading(false);
      }
    },
    [sheetId],
  );

  useEffect(() => {
    if (!open || rowId == null) return;
    setTimeline("hidden");
    setContactChanges("hidden");
    setAttachments(undefined);
    setDiscussions(undefined);
    setCommentText("");
    void loadSubmission(rowId);
  }, [open, rowId, loadSubmission]);

  async function toggleTimeline() {
    if (rowId == null) return;
    if (Array.isArray(timeline)) {
      setTimeline("hidden");
      return;
    }
    setTimeline("loading");
    try {
      const r = await fetch(withSheetId(`/api/forms/submissions/${rowId}/history`, sheetId));
      const d = await parseApiJson(r);
      if (!r.ok) {
        throw new Error(
          (typeof d.error === "string" && d.error) ||
            (typeof d.message === "string" && d.message) ||
            "Could not load timeline.",
        );
      }
      setTimeline((d.timeline as TimelineItem[]) ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load timeline.");
      setTimeline("hidden");
    }
  }

  async function toggleContactChanges() {
    if (rowId == null) return;
    if (Array.isArray(contactChanges)) {
      setContactChanges("hidden");
      return;
    }
    setContactChanges("loading");
    try {
      const r = await fetch(withSheetId(`/api/forms/submissions/${rowId}/contact-change`, sheetId));
      const d = await parseApiJson(r);
      if (!r.ok) {
        throw new Error(
          (typeof d.error === "string" && d.error) ||
            (typeof d.message === "string" && d.message) ||
            "Could not load contact changes.",
        );
      }
      setContactChanges(Array.isArray(d.history) ? (d.history as ContactChangeLogItem[]) : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load contact changes.");
      setContactChanges("hidden");
    }
  }

  async function refreshContactChangesIfOpen() {
    if (rowId == null || !Array.isArray(contactChanges)) return;
    try {
      const r = await fetch(withSheetId(`/api/forms/submissions/${rowId}/contact-change`, sheetId));
      const d = await parseApiJson(r);
      if (r.ok && Array.isArray(d.history)) {
        setContactChanges(d.history as ContactChangeLogItem[]);
      }
    } catch {
      // leave existing log visible
    }
  }

  function loadExtras() {
    if (rowId == null) return;
    if (!attachments) {
      setAttachments("loading");
      fetch(withSheetId(`/api/forms/submissions/${rowId}/attachments`, sheetId))
        .then((r) => r.json())
        .then((d) => setAttachments(d.attachments ?? []))
        .catch(() => setAttachments([]));
    }
    if (!discussions) {
      setDiscussions("loading");
      fetch(withSheetId(`/api/forms/submissions/${rowId}/discussions`, sheetId))
        .then((r) => r.json())
        .then((d) => setDiscussions(d.discussions ?? []))
        .catch(() => setDiscussions([]));
    }
  }

  async function resendNotification() {
    if (rowId == null) return;
    setActionBusy(rowId);
    setError("");
    try {
      const r = await fetch(`/api/forms/submissions/${rowId}/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(resendColumnTitle ? { columnTitle: resendColumnTitle } : {}),
          ...(sheetId ? { sheetId } : {}),
        }),
      });
      const d = await parseApiJson(r);
      if (!r.ok) {
        throw new Error(
          (typeof d.error === "string" && d.error) ||
            (typeof d.message === "string" && d.message) ||
            "Resend failed.",
        );
      }
      await loadSubmission(rowId);
      onChanged?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Resend failed.");
    } finally {
      setActionBusy(null);
    }
  }

  async function postComment() {
    if (rowId == null) return;
    const text = commentText.trim();
    if (!text) return;
    try {
      const r = await fetch(withSheetId(`/api/forms/submissions/${rowId}/discussions`, sheetId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, ...(sheetId ? { sheetId } : {}) }),
      });
      const d = await parseApiJson(r);
      if (!r.ok) {
        throw new Error(
          (typeof d.error === "string" && d.error) ||
            (typeof d.message === "string" && d.message) ||
            "Could not add comment.",
        );
      }
      setCommentText("");
      setDiscussions("loading");
      const dr = await fetch(withSheetId(`/api/forms/submissions/${rowId}/discussions`, sheetId));
      const dd = await dr.json();
      setDiscussions(dd.discussions ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not add comment.");
    }
  }

  const canReroute =
    roles.includes("admin") ||
    roles.includes("approver") ||
    roles.includes("coordinator") ||
    roles.includes("programs_team");

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <div className="p-1 sm:p-2">
        {loading ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-[color:var(--wsu-muted)]">Loading submission…</p>
          </div>
        ) : error && !submission ? (
          <div className="px-6 py-8 text-center">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        ) : submission ? (
          <div className="space-y-3 pt-6">
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{error}</div>
            ) : null}
            <SubmissionCard
              submission={submission}
              roles={roles}
              actionBusy={actionBusy}
              timeline={timeline}
              contactChanges={canReroute ? contactChanges : undefined}
              attachments={attachments}
              discussions={discussions}
              commentText={commentText}
              canResend={canResend}
              resendHint={resendHint}
              sheetId={sheetId}
              onCommentChange={setCommentText}
              onResend={() => void resendNotification()}
              onToggleTimeline={() => void toggleTimeline()}
              onToggleContactChanges={canReroute ? () => void toggleContactChanges() : undefined}
              onLoadExtras={loadExtras}
              onPostComment={() => void postComment()}
              reroutePanel={
                canReroute &&
                (submission.approvalStatus?.state === "current" ||
                  submission.approvalStatus?.state === "not-started") ? (
                  <RerouteApproverPanel
                    embedded
                    rowId={submission.rowId}
                    sheetId={sheetId}
                    onSubmitted={() => {
                      onChanged?.();
                      void refreshContactChangesIfOpen();
                    }}
                  />
                ) : undefined
              }
              className="border-0 shadow-none"
            />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
