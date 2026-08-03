"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface StageContactInfo {
  name: string;
  columnId: number;
  isCurrent: boolean;
  contact: {
    currentEmail: string;
    currentName: string;
    fields: Array<{ columnTitle: string; kind: string; currentDisplay: string }>;
  };
  pendingRequestId: string | null;
  pendingProposedEmail: string | null;
  pendingProposedName: string | null;
}

interface RerouteApproverPanelProps {
  rowId: number;
  sheetId?: string | null;
  /** Only show when submission is in review / has editable stages. */
  enabled?: boolean;
  onSubmitted?: () => void;
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

function withSheetId(path: string, sheetId?: string | null): string {
  if (!sheetId) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}sheetId=${encodeURIComponent(sheetId)}`;
}

function emailDomainError(email: string, allowedDomains: string[]): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Enter a valid email address.";
  if (!allowedDomains.length) return null;
  const domain = trimmed.split("@")[1]?.toLowerCase() ?? "";
  if (!allowedDomains.includes(domain)) {
    return `Email must be from: ${allowedDomains.join(", ")}.`;
  }
  return null;
}

export function RerouteApproverPanel({ rowId, sheetId, enabled = true, onSubmitted }: RerouteApproverPanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [stages, setStages] = useState<StageContactInfo[]>([]);
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [stageTitle, setStageTitle] = useState("");
  const [proposedName, setProposedName] = useState("");
  const [proposedEmail, setProposedEmail] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(withSheetId(`/api/forms/submissions/${rowId}/contact-change`, sheetId));
      const d = await parseApiJson(r);
      if (!r.ok) {
        throw new Error(
          (typeof d.error === "string" && d.error) ||
            (typeof d.message === "string" && d.message) ||
            "Could not load contact fields.",
        );
      }
      const list = Array.isArray(d.stages) ? (d.stages as StageContactInfo[]) : [];
      setStages(list);
      setAllowedDomains(
        Array.isArray(d.allowedDomains) ? (d.allowedDomains as string[]).map((v) => String(v).toLowerCase()) : [],
      );
      const current = list.find((s) => s.isCurrent) ?? list[0];
      if (current) {
        setStageTitle(current.name);
        // Start blank when proposing a change so name/email must be entered deliberately.
        setProposedName(current.pendingProposedName || "");
        setProposedEmail(current.pendingProposedEmail || "");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load contact fields.");
      setStages([]);
      setAllowedDomains([]);
    } finally {
      setLoading(false);
    }
  }, [rowId, sheetId]);

  useEffect(() => {
    if (!open || !enabled) return;
    void load();
  }, [open, enabled, load]);

  function selectStage(name: string) {
    setStageTitle(name);
    const st = stages.find((s) => s.name === name);
    if (!st) return;
    setProposedName(st.pendingProposedName || "");
    setProposedEmail(st.pendingProposedEmail || "");
    setError("");
    setSuccess("");
  }

  const nameReady = proposedName.trim().length >= 2;
  const emailError = useMemo(
    () => emailDomainError(proposedEmail, allowedDomains),
    [proposedEmail, allowedDomains],
  );
  const canSubmit =
    nameReady && !emailError && Boolean(proposedEmail.trim()) && Boolean(stages.find((s) => s.name === stageTitle)?.contact.fields.length);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nameReady) {
      setError("Name is required.");
      return;
    }
    if (emailError) {
      setError(emailError);
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const r = await fetch(`/api/forms/submissions/${rowId}/contact-change`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stageTitle,
          proposedName: proposedName.trim(),
          proposedEmail: proposedEmail.trim(),
          note: note.trim() || undefined,
          ...(sheetId ? { sheetId } : {}),
        }),
      });
      const d = await parseApiJson(r);
      if (!r.ok) {
        throw new Error(
          (typeof d.error === "string" && d.error) ||
            (typeof d.message === "string" && d.message) ||
            "Could not submit reroute.",
        );
      }
      setSuccess(
        typeof d.message === "string"
          ? d.message
          : "Submitted for Programs Team review. The new approver will not be notified until approved.",
      );
      setNote("");
      await load();
      onSubmitted?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not submit reroute.");
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) return null;

  const selected = stages.find((s) => s.name === stageTitle);
  const hasPending = Boolean(selected?.pendingRequestId);
  const domainHint = allowedDomains.length ? `Must use @${allowedDomains.join(", @")}` : null;

  return (
    <div className="rounded-xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-[color:var(--wsu-ink)]"
      >
        <span>Reroute approver contact</span>
        <span className="text-xs font-normal text-[color:var(--wsu-muted)]">{open ? "Hide" : "Show"}</span>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-[color:var(--wsu-border)] px-4 py-3">
          <p className="text-xs text-[color:var(--wsu-muted)]">
            Update the name/email for a stage that has not been approved yet. Both new name and new email are
            required. Changes go to Programs Team for review — the new approver is not notified until approved.
          </p>

          {loading ? <p className="text-sm text-[color:var(--wsu-muted)]">Loading contact fields…</p> : null}
          {error ? <p className="text-sm text-red-800">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-800">{success}</p> : null}

          {!loading && stages.length === 0 ? (
            <p className="text-sm text-[color:var(--wsu-muted)]">
              No editable approval stages on this submission (already complete or declined).
            </p>
          ) : null}

          {!loading && stages.length > 0 ? (
            <form onSubmit={(e) => void submit(e)} className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-[color:var(--wsu-ink)]">Approval stage</span>
                <select
                  value={stageTitle}
                  onChange={(e) => selectStage(e.target.value)}
                  className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                  disabled={busy}
                >
                  {stages.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name}
                      {s.isCurrent ? " (current)" : ""}
                      {s.pendingRequestId ? " — pending review" : ""}
                    </option>
                  ))}
                </select>
              </label>

              {selected?.contact.fields.length ? (
                <p className="text-xs text-[color:var(--wsu-muted)]">
                  Current:{" "}
                  {[selected.contact.currentName, selected.contact.currentEmail].filter(Boolean).join(" · ") ||
                    selected.contact.fields.map((f) => f.currentDisplay).filter(Boolean).join(" · ") ||
                    "—"}
                </p>
              ) : (
                <p className="text-xs text-amber-800">
                  No matching Name/Email columns found for this stage. Check column titles on the sheet.
                </p>
              )}

              {hasPending ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  A reroute is already pending Programs Team review
                  {selected?.pendingProposedEmail
                    ? ` → ${[selected.pendingProposedName, selected.pendingProposedEmail].filter(Boolean).join(" · ")}`
                    : ""}
                  .
                </p>
              ) : (
                <>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-[color:var(--wsu-ink)]">
                      New name <span className="text-wsu-crimson">*</span>
                    </span>
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={proposedName}
                      onChange={(e) => setProposedName(e.target.value)}
                      className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                      disabled={busy}
                      placeholder="Approver name"
                      autoComplete="name"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-[color:var(--wsu-ink)]">
                      New email <span className="text-wsu-crimson">*</span>
                    </span>
                    <input
                      type="email"
                      required
                      value={proposedEmail}
                      onChange={(e) => setProposedEmail(e.target.value)}
                      className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                      disabled={busy}
                      placeholder={allowedDomains[0] ? `approver@${allowedDomains[0]}` : "approver@wsu.edu"}
                      autoComplete="email"
                    />
                    {domainHint ? <span className="text-xs text-[color:var(--wsu-muted)]">{domainHint}</span> : null}
                    {proposedEmail.trim() && emailError ? (
                      <span className="text-xs text-red-800">{emailError}</span>
                    ) : null}
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-[color:var(--wsu-ink)]">Note (optional)</span>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                      disabled={busy}
                      placeholder="Why this reroute is needed"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={busy || !canSubmit}
                    className="inline-flex min-h-9 items-center justify-center rounded-full bg-wsu-crimson px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {busy ? "Submitting…" : "Submit for Programs Team review"}
                  </button>
                </>
              )}
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
