"use client";

import { useMemo, useState } from "react";
import { Button, TableShell } from "@/components/admin/WorkspacePrimitives";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import type { AdminAccountSummary, ManagedAdminStorageMode, ManagedAdminUserSummary } from "@/lib/admin-users";

interface AdminUsersManagerProps {
  bootstrapUser: AdminAccountSummary | null;
  initialUsers: ManagedAdminUserSummary[];
  ownerLabel: string;
  storageMode: ManagedAdminStorageMode;
}

interface UserFormState {
  username: string;
  displayName: string;
  password: string;
  isActive: boolean;
}

const USERNAME_PATTERN = "^[a-z0-9._@-]+$";
const PASSWORD_HINT =
  "At least 8 characters, with one uppercase letter, one number, and one special character such as !, *, or _.";

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-crimson focus:ring-1 focus:ring-crimson";

function emptyForm(): UserFormState {
  return {
    username: "",
    displayName: "",
    password: "",
    isActive: true,
  };
}

function sortUsers(users: ManagedAdminUserSummary[]) {
  return [...users].sort((left, right) => {
    const leftLabel = left.displayName ?? left.username;
    const rightLabel = right.displayName ?? right.username;
    return leftLabel.localeCompare(rightLabel);
  });
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildErrorMessage(payload: { message?: string; error?: string; errors?: string[] } | null) {
  const lead = payload?.message ?? payload?.error ?? "Request failed.";
  if (!payload?.errors?.length) return lead;
  return `${lead} ${payload.errors.join(" ")}`;
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${
        active ? "bg-[var(--crimson-soft)] text-crimson" : "bg-[#f4f0f1] text-sub"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function AdminUsersManager({
  bootstrapUser,
  initialUsers,
  ownerLabel,
  storageMode,
}: AdminUsersManagerProps) {
  const toast = useToast();
  const [users, setUsers] = useState(() => sortUsers(initialUsers));
  const [form, setForm] = useState<UserFormState>(() => emptyForm());
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const storageLabel = storageMode === "database" ? "Postgres" : "Local files";
  const storageDescription =
    storageMode === "database"
      ? "Managed admins are stored in Postgres and can sign in without environment variables."
      : "Managed admins are stored in local config files. Use DATABASE_URL in production for durable storage.";

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => {
      const name = (user.displayName ?? "").toLowerCase();
      return name.includes(q) || user.username.toLowerCase().includes(q);
    });
  }, [users, query]);

  function closeModal() {
    setModalOpen(false);
    setEditingUserId(null);
    setForm(emptyForm());
    setShowPassword(false);
    setError(null);
  }

  function openCreate() {
    setEditingUserId(null);
    setForm(emptyForm());
    setShowPassword(false);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(user: ManagedAdminUserSummary) {
    setEditingUserId(user.id);
    setForm({
      username: user.username,
      displayName: user.displayName ?? "",
      password: "",
      isActive: user.isActive,
    });
    setShowPassword(false);
    setError(null);
    setModalOpen(true);
  }

  function handleInputChange<Key extends keyof UserFormState>(key: Key, value: UserFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);

    const endpoint = editingUserId ? `/api/admin/users/${editingUserId}` : "/api/admin/users";
    const method = editingUserId ? "PUT" : "POST";

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username,
          displayName: form.displayName,
          password: form.password,
          isActive: form.isActive,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        user?: ManagedAdminUserSummary;
        message?: string;
        error?: string;
        errors?: string[];
      } | null;

      if (!response.ok || !payload?.user) {
        const msg = buildErrorMessage(payload);
        setError(msg);
        toast.addToast(msg, "error");
        return;
      }

      const savedUser = payload.user;
      setUsers((current) => sortUsers([...current.filter((user) => user.id !== savedUser.id), savedUser]));
      toast.addToast(editingUserId ? "Admin updated." : "Admin created.", "success");
      closeModal();
    } catch {
      setError("Unable to save the admin user.");
      toast.addToast("Unable to save the admin user.", "error");
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete(user: ManagedAdminUserSummary) {
    const confirmed = window.confirm(`Delete admin account ${user.displayName ?? user.username}?`);
    if (!confirmed) return;

    setIsPending(true);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        error?: string;
        errors?: string[];
      } | null;
      if (!response.ok) {
        const msg = buildErrorMessage(payload);
        toast.addToast(msg, "error");
        return;
      }

      setUsers((current) => current.filter((entry) => entry.id !== user.id));
      if (editingUserId === user.id) closeModal();
      toast.addToast("Admin deleted.", "success");
    } catch {
      toast.addToast("Unable to delete the admin user.", "error");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-[color:var(--wsu-stone)] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-normal text-[color:var(--wsu-muted)]">Bootstrap owner</p>
            <p className="mt-1 text-sm font-medium text-ink">{ownerLabel}</p>
            <p className="mt-1 text-xs text-sub">
              Environment-configured break-glass account. Read-only here — credentials stay in env vars.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs text-sub">
            <span className="font-medium text-ink">Username</span>
            <p className="mt-0.5 font-mono text-[12px] text-ink">{bootstrapUser?.username ?? "Not configured"}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <label className="relative block min-w-[14rem] max-w-md flex-1">
            <span className="sr-only">Search admins</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or username…"
              className={inputClass}
            />
          </label>
          <span className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-sub">
            {storageLabel}
          </span>
        </div>
        <Button type="button" variant="primary" onClick={openCreate}>
          Create admin
        </Button>
      </div>

      <p className="text-xs text-sub">{storageDescription}</p>

      {filteredUsers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-[#fdfbfc] px-5 py-12 text-center">
          <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--crimson-line)] bg-white text-sm font-semibold text-crimson">
            A
          </div>
          <h3 className="mt-3 text-sm font-medium text-ink">
            {query.trim() ? "No admins match your search" : "No managed admins yet"}
          </h3>
          <p className="mx-auto mt-1 max-w-[34ch] text-[13px] text-sub">
            {query.trim()
              ? "Try a different name or username."
              : "Create a managed admin so day-to-day work doesn’t depend on the bootstrap owner."}
          </p>
          {!query.trim() ? (
            <div className="mt-4">
              <Button type="button" variant="primary" onClick={openCreate}>
                Create admin
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <TableShell headers={["Admin", "Username", "Status", "Updated", "Actions"]} columns={5} endAlignLastHeader>
          <div className="divide-y divide-line">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="grid grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-5 sm:items-center"
              >
                <div className="min-w-0 sm:col-span-1">
                  <p className="truncate text-sm font-medium text-ink">{user.displayName ?? user.username}</p>
                </div>
                <p className="truncate text-xs text-sub sm:text-sm">{user.username}</p>
                <div>
                  <StatusPill active={user.isActive} />
                </div>
                <p className="hidden text-xs text-sub sm:block">{formatTimestamp(user.updatedAt)}</p>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Button type="button" onClick={() => openEdit(user)} disabled={isPending}>
                    Edit
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleDelete(user)}
                    disabled={isPending}
                    className="border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TableShell>
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          if (!isPending) closeModal();
        }}
        title={editingUserId ? "Edit admin" : "Create admin"}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4 sm:px-6">
          <p className="text-sm text-sub">
            Passwords are hashed before storage. Any signed-in admin can create and manage these accounts.
          </p>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Username</span>
            <input
              type="text"
              required
              pattern={USERNAME_PATTERN}
              value={form.username}
              onChange={(event) => handleInputChange("username", event.target.value.toLowerCase())}
              disabled={Boolean(editingUserId) || isPending}
              className={inputClass}
            />
            <span className="text-xs text-sub">Lowercase letters, numbers, dots, dashes, underscores, and @ only.</span>
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Display name</span>
            <input
              type="text"
              value={form.displayName}
              onChange={(event) => handleInputChange("displayName", event.target.value)}
              disabled={isPending}
              className={inputClass}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">
              {editingUserId ? "New password (optional)" : "Password"}
            </span>
            <div className="flex overflow-hidden rounded-lg border border-line bg-white focus-within:border-crimson focus-within:ring-1 focus-within:ring-crimson">
              <input
                type={showPassword ? "text" : "password"}
                required={!editingUserId}
                value={form.password}
                onChange={(event) => handleInputChange("password", event.target.value)}
                disabled={isPending}
                className="w-full px-3 py-2.5 text-sm text-ink outline-none disabled:bg-[#faf7f8]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                disabled={isPending}
                className="border-l border-line px-3 text-sm font-medium text-crimson transition hover:bg-[var(--crimson-soft)] disabled:opacity-50"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <span className="text-xs text-sub">
              {editingUserId ? `Leave blank to keep the current password. ${PASSWORD_HINT}` : PASSWORD_HINT}
            </span>
          </label>

          <label className="flex items-center gap-2.5 rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => handleInputChange("isActive", event.target.checked)}
              disabled={isPending}
              className="h-4 w-4 rounded border-line text-crimson focus:ring-crimson"
            />
            Allow this admin to sign in
          </label>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
            <Button type="button" onClick={closeModal} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? "Saving…" : editingUserId ? "Save changes" : "Create admin"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
