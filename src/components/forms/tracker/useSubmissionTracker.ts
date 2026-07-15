"use client";

import { useCallback, useEffect, useState } from "react";

export interface TrackerStep {
  name: string;
  value: string;
  display: "done" | "current" | "declined" | "upcoming";
}

export interface TrackerSubmission {
  rowId: number;
  label: string;
  email: string;
  createdAt: string | null;
  stages: TrackerStep[];
  overall: string;
  approvalStatus: {
    label: string;
    stage: string;
    value: string;
    state: "done" | "current" | "declined" | "complete" | "not-started";
  };
}

export interface TimelineItem {
  name: string;
  value: string;
  at: string | null;
  by: string | null;
}

export interface TrackerAttachment {
  id: number;
  name: string;
  mimeType?: string;
}

export interface TrackerDiscussion {
  id: number;
  comments?: { text: string; createdBy?: { name?: string }; createdAt?: string }[];
}

async function parseApiJson(r: Response): Promise<Record<string, unknown>> {
  const text = await r.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(r.ok ? "Invalid response from server." : text.slice(0, 120) || `Request failed (${r.status}).`);
  }
}

export function useSubmissionTracker() {
  const [subs, setSubs] = useState<TrackerSubmission[] | null>(null);
  const [sheetName, setSheetName] = useState("");
  const [demo, setDemo] = useState(false);
  const [roles, setRoles] = useState<string[]>(["viewer"]);
  const [workflowStages, setWorkflowStages] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timelines, setTimelines] = useState<Record<number, TimelineItem[] | "loading" | "hidden">>({});
  const [attachments, setAttachments] = useState<Record<number, TrackerAttachment[] | "loading">>({});
  const [discussions, setDiscussions] = useState<Record<number, TrackerDiscussion[] | "loading">>({});
  const [commentText, setCommentText] = useState<Record<number, string>>({});
  const [actionBusy, setActionBusy] = useState<number | null>(null);
  const [lastPoll, setLastPoll] = useState("");

  const loadSubs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const r = await fetch("/api/forms/submissions");
      const d = await parseApiJson(r);
      if (!r.ok) {
        throw new Error(
          (typeof d.error === "string" && d.error) ||
            (typeof d.message === "string" && d.message) ||
            `Could not load submissions (${r.status}).`,
        );
      }
      setSubs((d.submissions as TrackerSubmission[]) ?? []);
      setSheetName(typeof d.sheetName === "string" ? d.sheetName : "");
      setDemo(Boolean(d.demo));
      setRoles(Array.isArray(d.roles) ? (d.roles as string[]) : ["viewer"]);
      setWorkflowStages(Array.isArray(d.stages) ? (d.stages as string[]) : []);
      setLastPoll(new Date().toISOString());
      setError("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load submissions.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSubs();
  }, [loadSubs]);

  useEffect(() => {
    if (!lastPoll) return;
    const id = setInterval(async () => {
      try {
        const r = await fetch(`/api/forms/submissions/stream?since=${encodeURIComponent(lastPoll)}`);
        const d = await parseApiJson(r);
        if (r.ok && Array.isArray(d.submissions)) {
          setSubs(d.submissions as TrackerSubmission[]);
          if (Array.isArray(d.recentEvents) && d.recentEvents.length > 0 && typeof d.at === "string") {
            setLastPoll(d.at);
          }
        }
      } catch {
        /* ignore poll errors */
      }
    }, 30000);
    return () => clearInterval(id);
  }, [lastPoll]);

  async function toggleTimeline(rowId: number) {
    const cur = timelines[rowId];
    if (Array.isArray(cur)) {
      setTimelines((p) => ({ ...p, [rowId]: "hidden" }));
      return;
    }
    setTimelines((p) => ({ ...p, [rowId]: "loading" }));
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
      setTimelines((p) => ({ ...p, [rowId]: (d.timeline as TimelineItem[]) ?? [] }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load timeline.");
      setTimelines((p) => ({ ...p, [rowId]: "hidden" }));
    }
  }

  async function loadExtras(rowId: number) {
    if (!attachments[rowId]) {
      setAttachments((p) => ({ ...p, [rowId]: "loading" }));
      fetch(`/api/forms/submissions/${rowId}/attachments`)
        .then((r) => r.json())
        .then((d) => setAttachments((p) => ({ ...p, [rowId]: d.attachments ?? [] })))
        .catch(() => setAttachments((p) => ({ ...p, [rowId]: [] })));
    }
    if (!discussions[rowId]) {
      setDiscussions((p) => ({ ...p, [rowId]: "loading" }));
      fetch(`/api/forms/submissions/${rowId}/discussions`)
        .then((r) => r.json())
        .then((d) => setDiscussions((p) => ({ ...p, [rowId]: d.discussions ?? [] })))
        .catch(() => setDiscussions((p) => ({ ...p, [rowId]: [] })));
    }
  }

  async function patchRow(rowId: number, action: "approve" | "decline") {
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
      await loadSubs(true);
      setTimelines((p) => ({ ...p, [rowId]: "hidden" }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setActionBusy(null);
    }
  }

  async function deleteRow(rowId: number) {
    if (!confirm("Delete this submission permanently?")) return;
    setActionBusy(rowId);
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
      await loadSubs(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setActionBusy(null);
    }
  }

  async function postComment(rowId: number) {
    const text = (commentText[rowId] ?? "").trim();
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
      setCommentText((p) => ({ ...p, [rowId]: "" }));
      setDiscussions((p) => ({ ...p, [rowId]: "loading" }));
      const dr = await fetch(`/api/forms/submissions/${rowId}/discussions`);
      const dd = await dr.json();
      setDiscussions((p) => ({ ...p, [rowId]: dd.discussions ?? [] }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not add comment.");
    }
  }

  return {
    subs,
    sheetName,
    demo,
    roles,
    workflowStages,
    error,
    loading,
    refreshing,
    timelines,
    attachments,
    discussions,
    commentText,
    actionBusy,
    setCommentText,
    loadSubs,
    toggleTimeline,
    loadExtras,
    patchRow,
    deleteRow,
    postComment,
  };
}
