"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ADMIN_TABLE_PAGE_SIZE,
  AdminDataTable,
  resolveAdminTablePage,
} from "@/components/admin/AdminDataTable";
import { Button, EmptyState } from "@/components/admin/WorkspacePrimitives";

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

function contributorsBasePath(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return "/admin/contributors";
  return `/admin/contributors?q=${encodeURIComponent(trimmed)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function ContributorAccountsManager({
  users: initialUsers,
  page: initialPage,
  query: initialQuery = "",
}: {
  users: ContributorUser[];
  page: number;
  query?: string;
}) {
  const router = useRouter();
  const [users, setUsers] = useState<ContributorUser[]>(initialUsers);
  const [query, setQuery] = useState(initialQuery);
  const [resetLink, setResetLink] = useState<ResetLinkState | null>(null);
  const [loadingResetId, setLoadingResetId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  // Filter from the URL query so pagination links stay aligned with the applied search.
  const filteredUsers = useMemo(() => {
    const q = initialQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => user.email.toLowerCase().includes(q));
  }, [users, initialQuery]);

  const page = resolveAdminTablePage(String(initialPage), filteredUsers.length);
  const basePath = contributorsBasePath(initialQuery);

  function applySearch(event: React.FormEvent) {
    event.preventDefault();
    router.push(contributorsBasePath(query));
  }

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
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to remove contributor.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={applySearch} className="flex flex-wrap items-center gap-2">
        <label className="relative block min-w-[14rem] max-w-md flex-1">
          <span className="sr-only">Search contributors</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by email…"
            className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-crimson focus:ring-1 focus:ring-crimson"
          />
        </label>
        <Button type="submit">Search</Button>
        {query.trim() ? (
          <Button
            type="button"
            onClick={() => {
              setQuery("");
              router.push("/admin/contributors");
            }}
          >
            Clear
          </Button>
        ) : null}
        <span className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-sub">
          {filteredUsers.length} account{filteredUsers.length === 1 ? "" : "s"}
        </span>
      </form>

      {actionError ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {actionError}
        </div>
      ) : null}

      {resetLink ? (
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="mb-2 text-sm font-medium text-ink">Reset link generated</p>
          <p className="mb-3 text-xs text-sub">
            Copy this link and send it to the contributor. It expires in 24 hours and can only be used once.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              readOnly
              value={resetLink.url}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="min-h-[40px] min-w-[12rem] flex-1 rounded-lg border border-line bg-white px-3 py-2 font-mono text-xs"
            />
            <Button type="button" onClick={() => handleCopy(resetLink.url)}>
              {resetLink.copied ? "Copied!" : "Copy"}
            </Button>
            <Button type="button" onClick={() => setResetLink(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      <AdminDataTable
        headers={["Email", "Created", "Last updated", "Actions"]}
        items={filteredUsers}
        page={page}
        basePath={basePath}
        pageSize={ADMIN_TABLE_PAGE_SIZE}
        endAlignLastHeader
        getRowKey={(user) => user.id}
        empty={
          <EmptyState
            icon={<span className="text-sm font-semibold">C</span>}
            title={initialQuery.trim() ? "No contributors match your search" : "No contributors yet"}
            description={
              initialQuery.trim()
                ? "Try a different email address."
                : "Accounts are created when contributors complete first-time access."
            }
            variant="panel"
          />
        }
        renderRow={(user) => (
          <>
            <div className="min-w-0 sm:col-span-1">
              <p className="truncate text-sm font-medium text-ink">{user.email}</p>
            </div>
            <p className="hidden text-sm text-sub sm:block">{formatDate(user.createdAt)}</p>
            <p className="hidden text-sm text-sub sm:block">{formatDate(user.updatedAt)}</p>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Button
                type="button"
                disabled={loadingResetId === user.id}
                onClick={() => void handleGenerateResetLink(user)}
              >
                {loadingResetId === user.id ? "Generating…" : "Generate reset link"}
              </Button>
              <Button
                type="button"
                disabled={removingId === user.id}
                onClick={() => void handleRemove(user)}
                className="border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100"
              >
                {removingId === user.id ? "Removing…" : "Remove"}
              </Button>
            </div>
          </>
        )}
      />
    </div>
  );
}
