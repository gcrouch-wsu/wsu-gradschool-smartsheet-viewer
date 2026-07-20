"use client";

import { useState } from "react";
import { DataTable } from "@/components/ui/Table";

interface ContributorUser {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

interface ResetLinkState {
  userId: string;
  url: string;
  copied: boolean;
}

export function ContributorAccountsManager({ users: initialUsers }: { users: ContributorUser[] }) {
  const [users, setUsers] = useState<ContributorUser[]>(initialUsers);
  const [resetLink, setResetLink] = useState<ResetLinkState | null>(null);
  const [loadingResetId, setLoadingResetId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleGenerateResetLink(user: ContributorUser) {
    setActionError(null);
    setLoadingResetId(user.id);
    try {
      const response = await fetch(`/api/admin/contributors/${encodeURIComponent(user.id)}/reset-token`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as { token?: string; message?: string } | null;
      if (!response.ok) {
        setActionError(payload?.message ?? "Failed to generate reset link.");
        return;
      }
      const token = payload?.token ?? "";
      const url = `${window.location.origin}/contributor/reset-password?token=${encodeURIComponent(token)}`;
      setResetLink({ userId: user.id, url, copied: false });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to generate reset link.");
    } finally {
      setLoadingResetId(null);
    }
  }

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setResetLink((prev) => (prev ? { ...prev, copied: true } : prev));
      setTimeout(() => {
        setResetLink((prev) => (prev ? { ...prev, copied: false } : prev));
      }, 2000);
    } catch {
      // fallback — select the text in the input
    }
  }

  async function handleRemove(user: ContributorUser) {
    if (!window.confirm(`Remove contributor account for ${user.email}?`)) return;
    setActionError(null);
    setRemovingId(user.id);
    try {
      const response = await fetch("/api/admin/contributors", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok) {
        setActionError(payload?.message ?? "Failed to remove contributor.");
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      if (resetLink?.userId === user.id) setResetLink(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to remove contributor.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {actionError && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {actionError}
        </div>
      )}

      {resetLink && (
        <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] p-4">
          <p className="mb-2 text-sm font-medium text-[color:var(--wsu-ink)]">Reset link generated</p>
          <p className="mb-3 text-xs text-[color:var(--wsu-muted)]">
            Copy this link and send it to the contributor. It expires in 24 hours and can only be used once.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={resetLink.url}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="min-h-[40px] flex-1 rounded-xl border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-xs font-mono"
            />
            <button
              type="button"
              onClick={() => handleCopy(resetLink.url)}
              className="rounded-xl border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-xs font-medium text-[color:var(--wsu-muted)] hover:border-[color:var(--wsu-crimson)] hover:text-[color:var(--wsu-crimson)]"
            >
              {resetLink.copied ? "Copied!" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => setResetLink(null)}
              className="rounded-xl border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-xs font-medium text-[color:var(--wsu-muted)] hover:border-[color:var(--wsu-crimson)] hover:text-[color:var(--wsu-crimson)]"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {users.length === 0 ? (
        <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] px-6 py-8 text-center text-sm text-[color:var(--wsu-muted)]">
          No contributor accounts yet. Accounts are created when contributors complete first-time access.
        </div>
      ) : (
        <DataTable
          columns={[
            {
              id: "email",
              header: "Email",
              headerClassName: "py-3 font-semibold uppercase tracking-[0.1em]",
              cellClassName: "font-medium",
              cell: (user) => user.email,
            },
            {
              id: "created",
              header: "Created",
              headerClassName: "hidden py-3 font-semibold uppercase tracking-[0.1em] sm:table-cell",
              cellClassName: "hidden text-[color:var(--wsu-muted)] sm:table-cell",
              cell: (user) => new Date(user.createdAt).toLocaleDateString(),
            },
            {
              id: "updated",
              header: "Last updated",
              headerClassName: "hidden py-3 font-semibold uppercase tracking-[0.1em] sm:table-cell",
              cellClassName: "hidden text-[color:var(--wsu-muted)] sm:table-cell",
              cell: (user) => new Date(user.updatedAt).toLocaleDateString(),
            },
            {
              id: "actions",
              header: "Actions",
              headerClassName: "py-3 font-semibold uppercase tracking-[0.1em]",
              cell: (user) => (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={loadingResetId === user.id}
                    onClick={() => handleGenerateResetLink(user)}
                    className="rounded-full border border-[color:var(--wsu-border)] bg-white px-3 py-1.5 text-xs font-medium text-[color:var(--wsu-muted)] hover:border-[color:var(--wsu-crimson)] hover:text-[color:var(--wsu-crimson)] disabled:opacity-50"
                  >
                    {loadingResetId === user.id ? "Generating..." : "Generate reset link"}
                  </button>
                  <button
                    type="button"
                    disabled={removingId === user.id}
                    onClick={() => handleRemove(user)}
                    className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                  >
                    {removingId === user.id ? "Removing..." : "Remove"}
                  </button>
                </div>
              ),
            },
          ]}
          data={users}
          getRowKey={(user) => user.id}
          rowClassName="hover:bg-[color:var(--wsu-stone)]/20"
          containerClassName="rounded-2xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)]"
        />
      )}
    </div>
  );
}
