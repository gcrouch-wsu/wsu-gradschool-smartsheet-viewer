"use client";

import { useCallback, useEffect, useState } from "react";

interface Step {
  name: string;
  value: string;
  display: "done" | "current" | "declined" | "upcoming";
}

interface Submission {
  rowId: number;
  label: string;
  email: string;
  createdAt: string | null;
  stages: Step[];
  overall: string;
  approvalStatus: {
    label: string;
    stage: string;
    value: string;
    state: "done" | "current" | "declined" | "complete" | "not-started";
  };
}

interface TimelineItem {
  name: string;
  value: string;
  at: string | null;
  by: string | null;
}

interface Attachment {
  id: number;
  name: string;
  mimeType?: string;
}

interface Discussion {
  id: number;
  comments?: { text: string; createdBy?: { name?: string }; createdAt?: string }[];
}

function canApprove(roles: string[]) {
  return roles.includes("admin") || roles.includes("approver");
}

function isAdmin(roles: string[]) {
  return roles.includes("admin");
}

export default function TrackerPage() {
  const [subs, setSubs] = useState<Submission[] | null>(null);
  const [sheetName, setSheetName] = useState("");
  const [demo, setDemo] = useState(false);
  const [roles, setRoles] = useState<string[]>(["viewer"]);
  const [workflowStages, setWorkflowStages] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [timelines, setTimelines] = useState<Record<number, TimelineItem[] | "loading" | "hidden">>({});
  const [attachments, setAttachments] = useState<Record<number, Attachment[] | "loading">>({});
  const [discussions, setDiscussions] = useState<Record<number, Discussion[] | "loading">>({});
  const [commentText, setCommentText] = useState<Record<number, string>>({});
  const [actionBusy, setActionBusy] = useState<number | null>(null);
  const [lastPoll, setLastPoll] = useState("");

  const loadSubs = useCallback(async () => {
    const r = await fetch("/api/forms/submissions");
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || d.message || "Could not load submissions.");
    setSubs(d.submissions);
    setSheetName(d.sheetName);
    setDemo(d.demo);
    setRoles(d.roles ?? ["viewer"]);
    setWorkflowStages(d.stages ?? []);
    setLastPoll(new Date().toISOString());
  }, []);

  useEffect(() => {
    loadSubs().catch((e) => setError(e.message));
  }, [loadSubs]);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const r = await fetch(`/api/forms/submissions/stream?since=${encodeURIComponent(lastPoll)}`);
        const d = await r.json();
        if (r.ok && d.submissions) {
          setSubs(d.submissions);
          if (d.recentEvents?.length) setLastPoll(d.at);
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
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.message || "Could not load timeline.");
      setTimelines((p) => ({ ...p, [rowId]: d.timeline }));
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
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.message || "Update failed.");
      await loadSubs();
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
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.message || "Delete failed.");
      await loadSubs();
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
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.message || "Could not add comment.");
      setCommentText((p) => ({ ...p, [rowId]: "" }));
      setDiscussions((p) => ({ ...p, [rowId]: "loading" }));
      const dr = await fetch(`/api/forms/submissions/${rowId}/discussions`);
      const dd = await dr.json();
      setDiscussions((p) => ({ ...p, [rowId]: dd.discussions ?? [] }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not add comment.");
    }
  }

  const shortName = (t: string) => t.replace(/\s*status$/i, "");
  const stepIcon = (d: Step["display"]) => (d === "done" ? "✓" : d === "declined" ? "✕" : d === "current" ? "●" : "○");
  const badgeClass = (o: string) =>
    /complete|approved|done/i.test(o) ? "badge--ok" : /declin|reject|denied/i.test(o) ? "badge--err" : "badge--neutral";

  const statusClass = (state: Submission["approvalStatus"]["state"]) => {
    if (state === "complete") return "approval-status--ok";
    if (state === "declined") return "approval-status--err";
    if (state === "current") return "approval-status--current";
    return "approval-status--neutral";
  };

  const approver = canApprove(roles);
  const admin = isAdmin(roles);

  const subtitle = sheetName
    ? `${demo ? "Demo data for" : "From"} "${sheetName}". ${workflowStages.length ? `${workflowStages.length} routing stages.` : "No routing columns detected."} Auto-refreshes every 30s.`
    : undefined;

  return (
    <div className="forms-wrap">
      <div className="mb-5">
        <h2 className="forms-page-title">Submission tracker</h2>
        {subtitle ? <p className="forms-page-subtitle">{subtitle}</p> : null}
      </div>

      {error ? (
        <div className="card">
          <div className="note note--err">{error}</div>
        </div>
      ) : null}

      {!subs ? (
        <div className="card">
          <p className="spinner">Loading submissions…</p>
        </div>
      ) : subs.length === 0 ? (
        <div className="card">
          <p className="muted">
            No submissions yet. Add one from the <a href="/forms">form</a>.
          </p>
        </div>
      ) : (
        subs.map((s) => {
          const tl = timelines[s.rowId];
          const att = attachments[s.rowId];
          const disc = discussions[s.rowId];
          const meta = [s.email, s.createdAt ? new Date(s.createdAt).toLocaleDateString() : ""]
            .filter(Boolean)
            .join(" · ");
          const showActions = approver && s.approvalStatus?.state === "current";
          return (
            <div className="card sub-card" key={s.rowId}>
              <div className="sub-head">
                <div>
                  <div className="sub-name">{s.label}</div>
                  {meta ? <div className="muted">{meta}</div> : null}
                </div>
                <span className={`badge ${badgeClass(s.overall)}`}>{s.overall}</span>
              </div>

              <div className={`approval-status ${statusClass(s.approvalStatus?.state ?? "not-started")}`}>
                <span className="approval-status__label">Approval status</span>
                <strong className="approval-status__value">
                  {s.approvalStatus?.label ?? "In review"}
                  {s.approvalStatus?.value && s.approvalStatus.state === "current"
                    ? ` · ${s.approvalStatus.value}`
                    : ""}
                </strong>
              </div>

              {showActions ? (
                <div className="action-row">
                  <button
                    className="btn btn--sm"
                    disabled={actionBusy === s.rowId}
                    onClick={() => patchRow(s.rowId, "approve")}
                  >
                    Approve
                  </button>
                  <button
                    className="btn btn--ghost btn--sm"
                    disabled={actionBusy === s.rowId}
                    onClick={() => patchRow(s.rowId, "decline")}
                  >
                    Decline
                  </button>
                  {admin ? (
                    <button
                      className="btn btn--ghost btn--sm btn--danger"
                      disabled={actionBusy === s.rowId}
                      onClick={() => deleteRow(s.rowId)}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              ) : admin ? (
                <div className="action-row">
                  <button
                    className="btn btn--ghost btn--sm btn--danger"
                    disabled={actionBusy === s.rowId}
                    onClick={() => deleteRow(s.rowId)}
                  >
                    Delete submission
                  </button>
                </div>
              ) : null}

              <ol className="stepper">
                {s.stages.map((st, i) => (
                  <li className={`step step--${st.display}`} key={st.name}>
                    <span className="step__dot">{stepIcon(st.display)}</span>
                    <span className="step__name">{shortName(st.name)}</span>
                    <span className="step__val">{st.value || "—"}</span>
                    {i < s.stages.length - 1 ? <span className="step__bar" /> : null}
                  </li>
                ))}
              </ol>

              <div className="timeline-row">
                <button className="btn btn--ghost btn--sm" onClick={() => toggleTimeline(s.rowId)} disabled={tl === "loading"}>
                  {tl === "loading" ? "Loading…" : Array.isArray(tl) ? "Hide timeline" : "Show timeline"}
                </button>
                <button className="btn btn--ghost btn--sm" onClick={() => loadExtras(s.rowId)}>
                  Files & notes
                </button>
                {Array.isArray(tl) ? (
                  <div className="timeline">
                    {tl.length === 0 ? (
                      <div className="muted">No recorded decisions yet.</div>
                    ) : (
                      tl.map((t) => (
                        <div className="tl-item" key={t.name}>
                          <span className="tl-name">{shortName(t.name)}</span>
                          <span className="tl-val">{t.value}</span>
                          <span className="tl-meta">
                            {t.at ? new Date(t.at).toLocaleString() : "date unknown"}
                            {t.by ? ` · by ${t.by}` : ""}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
                {att === "loading" || disc === "loading" ? <p className="muted">Loading files & notes…</p> : null}
                {Array.isArray(att) && att.length > 0 ? (
                  <div className="extras-block">
                    <strong>Attachments</strong>
                    <ul>
                      {att.map((a) => (
                        <li key={a.id}>{a.name}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {Array.isArray(disc) ? (
                  <div className="extras-block">
                    <strong>Discussion</strong>
                    {disc.length === 0 ? <p className="muted">No comments yet.</p> : null}
                    {disc.flatMap((d) => d.comments ?? []).map((c, i) => (
                      <div className="comment" key={i}>
                        <span>{c.text}</span>
                        <span className="muted">
                          {c.createdBy?.name ? ` · ${c.createdBy.name}` : ""}
                          {c.createdAt ? ` · ${new Date(c.createdAt).toLocaleString()}` : ""}
                        </span>
                      </div>
                    ))}
                    {approver ? (
                      <div className="comment-form">
                        <input
                          type="text"
                          placeholder="Add a note…"
                          value={commentText[s.rowId] ?? ""}
                          onChange={(e) => setCommentText((p) => ({ ...p, [s.rowId]: e.target.value }))}
                        />
                        <button className="btn btn--ghost btn--sm" type="button" onClick={() => postComment(s.rowId)}>
                          Post
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
