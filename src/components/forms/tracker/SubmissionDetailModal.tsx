"use client";

import { useCallback, useEffect, useState } from "react";
import { SubmissionCard } from "@/components/forms/tracker/SubmissionCard";
import type {
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

interface SubmissionDetailModalProps {
  rowId: number | null;
  open: boolean;
  onClose: () => void;
  /** Called after approve/decline/delete so the parent (e.g. grid) can refresh. */
  onChanged?: () => void;
}

export function SubmissionDetailModal({ rowId, open, onClose, onChanged }: SubmissionDetailModalProps) {
  const [submission, setSubmission] = useState<TrackerSubmission | null>(null);
  const [roles, setRoles] = useState<string[]>(["viewer"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState<number | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[] | "loading" | "hidden">("hidden");
  const [attachments, setAttachments] = useState<TrackerAttachment[] | "loading" | undefined>(undefined);
  const [discussions, setDiscussions] = useState<TrackerDiscussion[] | "loading" | undefined>(undefined);
  const [commentText, setCommentText] = useState("");

  const loadSubmission = useCallback(async (id: number) => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/forms/submissions/${id}`);
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
      if (!d.submission) setError("Submission not found.");
    } catch (e: unknown) {
      setSubmission(null);
      setError(e instanceof Error ? e.message : "Could not load submission.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || rowId == null) return;
    setTimeline("hidden");
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
      const r = await fetch(`/api/forms/submissions/${rowId}/history`);
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

  function loadExtras() {
    if (rowId == null) return;
    if (!attachments) {
      setAttachments("loading");
      fetch(`/api/forms/submissions/${rowId}/attachments`)
        .then((r) => r.json())
        .then((d) => setAttachments(d.attachments ?? []))
        .catch(() => setAttachments([]));
    }
    if (!discussions) {
      setDiscussions("loading");
      fetch(`/api/forms/submissions/${rowId}/discussions`)
        .then((r) => r.json())
        .then((d) => setDiscussions(d.discussions ?? []))
        .catch(() => setDiscussions([]));
    }
  }

  async function patchRow(action: "approve" | "decline") {
    if (rowId == null) return;
    setActionBusy(rowId);
    setError("");
    try {
      const r = await fetch(`/api/forms/submissions/${rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = await parseApiJson(r);
      if (!r.ok) {
        throw new Error(
          (typeof d.error === "string" && d.error) ||
            (typeof d.message === "string" && d.message) ||
            "Update failed.",
        );
      }
      setTimeline("hidden");
      await loadSubmission(rowId);
      onChanged?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setActionBusy(null);
    }
  }

  async function deleteRow() {
    if (rowId == null) return;
    if (!confirm("Delete this submission permanently?")) return;
    setActionBusy(rowId);
    setError("");
    try {
      const r = await fetch(`/api/forms/submissions/${rowId}`, { method: "DELETE" });
      const d = await parseApiJson(r);
      if (!r.ok) {
        throw new Error(
          (typeof d.error === "string" && d.error) ||
            (typeof d.message === "string" && d.message) ||
            "Delete failed.",
        );
      }
      onChanged?.();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setActionBusy(null);
    }
  }

  async function postComment() {
    if (rowId == null) return;
    const text = commentText.trim();
    if (!text) return;
    try {
      const r = await fetch(`/api/forms/submissions/${rowId}/discussions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
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
      const dr = await fetch(`/api/forms/submissions/${rowId}/discussions`);
      const dd = await dr.json();
      setDiscussions(dd.discussions ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not add comment.");
    }
  }

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
              attachments={attachments}
              discussions={discussions}
              commentText={commentText}
              onToggleTimeline={() => void toggleTimeline()}
              onLoadExtras={loadExtras}
              onApprove={() => void patchRow("approve")}
              onDecline={() => void patchRow("decline")}
              onDelete={() => void deleteRow()}
              onCommentChange={setCommentText}
              onPostComment={() => void postComment()}
              className="border-0 shadow-none"
            />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
