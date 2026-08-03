"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, TableShell } from "@/components/admin/WorkspacePrimitives";
import { IconMore } from "@/components/forms/icons";
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
  role: "admin" | "coordinator" | "programs_team";
}

interface ResetLinkState {
  userId: string;
  url: string;
  copied: boolean;
}

const USERNAME_PATTERN = "^[a-z0-9._@-]+$";
const PASSWORD_HINT =
  "At least 8 characters, with one uppercase letter, one number, and one special character such as !, *, or _.";

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-crimson focus:ring-1 focus:ring-crimson";

const iconBtnClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line-strong bg-white text-ink transition hover:border-mist hover:bg-[#faf7f8] disabled:cursor-not-allowed disabled:opacity-60";

const menuItemClass =
  "block w-full px-3 py-2 text-left text-xs font-medium text-ink hover:bg-[#faf7f8] disabled:opacity-50";

function emptyForm(): UserFormState {
  return {
    username: "",
    displayName: "",
    password: "",
    isActive: true,
    role: "admin",
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

function roleLabel(role: string) {
  if (role === "coordinator") return "Coordinator";
  if (role === "programs_team") return "Programs Team";
  return "Admin";
}

function normalizeFormRole(role: string): UserFormState["role"] {
  if (role === "coordinator") return "coordinator";
  if (role === "programs_team") return "programs_team";
  return "admin";
}

function StatusPill({ active, hasPassword }: { active: boolean; hasPassword: boolean }) {
  if (!active) {
    return (
      <span className="inline-flex rounded-full bg-[#f4f0f1] px-2.5 py-1 text-[11px] font-medium text-sub">
        Inactive
      </span>
    );
  }
  if (!hasPassword) {
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800">
        Pending setup
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-[var(--crimson-soft)] px-2.5 py-1 text-[11px] font-medium text-crimson">
      Active
    </span>
  );
}

function UserRowActions({
  user,
  busy,
  generatingReset,
  onGenerateResetLink,
  onEdit,
  onDelete,
}: {
  user: ManagedAdminUserSummary;
  busy: boolean;
  generatingReset: boolean;
  onGenerateResetLink: (user: ManagedAdminUserSummary) => void;
  onEdit: (user: ManagedAdminUserSummary) => void;
  onDelete: (user: ManagedAdminUserSummary) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const label = user.displayName ?? user.username;

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <div ref={rootRef} className="relative flex justify-start sm:justify-end">
      <button
        type="button"
        className={iconBtnClass}
        disabled={busy}
        onClick={() => setMenuOpen((open) => !open)}
        aria-label={`Actions for ${label}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        title="Actions"
      >
        <IconMore className="h-4 w-4" />
      </button>
      {menuOpen ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-[11rem] rounded-lg border border-line bg-white py-1 shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            className={menuItemClass}
            disabled={busy || generatingReset}
            onClick={() => {
              setMenuOpen(false);
              onGenerateResetLink(user);
            }}
          >
            {generatingReset ? "Generating…" : "Generate reset link"}
          </button>
          <button
            type="button"
            role="menuitem"
            className={menuItemClass}
            disabled={busy}
            onClick={() => {
              setMenuOpen(false);
              onEdit(user);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            className={`${menuItemClass} text-rose-700 hover:bg-rose-50`}
            disabled={busy}
            onClick={() => {
              setMenuOpen(false);
              onDelete(user);
            }}
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
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
  const [resetLink, setResetLink] = useState<ResetLinkState | null>(null);
  const [loadingResetId, setLoadingResetId] = useState<string | null>(null);

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
      role: normalizeFormRole(user.role),
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
          role: form.role,
          ...(editingUserId && form.password ? { password: form.password } : {}),
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
      toast.addToast(editingUserId ? "Admin updated." : "Admin added.", "success");
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
      if (resetLink?.userId === user.id) setResetLink(null);
      toast.addToast("Admin deleted.", "success");
    } catch {
      toast.addToast("Unable to delete the admin user.", "error");
    } finally {
      setIsPending(false);
    }
  }

  async function handleGenerateResetLink(user: ManagedAdminUserSummary) {
    setLoadingResetId(user.id);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/reset-token`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as { token?: string; message?: string } | null;
      if (!response.ok) {
        toast.addToast(payload?.message ?? "Failed to generate reset link.", "error");
        return;
      }
      const token = payload?.token ?? "";
      const url = `${window.location.origin}/admin/reset-password?token=${encodeURIComponent(token)}`;
      setResetLink({ userId: user.id, url, copied: false });
      toast.addToast("Reset link generated.", "success");
    } catch {
      toast.addToast("Failed to generate reset link.", "error");
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
              placeholder="Search by name or email…"
              className={inputClass}
            />
          </label>
          <span className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-sub">
            {storageLabel}
          </span>
        </div>
        <Button type="button" variant="primary" onClick={openCreate}>
          Add user
        </Button>
      </div>

      <p className="text-xs text-sub">{storageDescription}</p>

      {filteredUsers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-[#fdfbfc] px-5 py-12 text-center">
          <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--crimson-line)] bg-white text-sm font-semibold text-crimson">
            A
          </div>
          <h3 className="mt-3 text-sm font-medium text-ink">
            {query.trim() ? "No users match your search" : "No managed users yet"}
          </h3>
          <p className="mx-auto mt-1 max-w-[34ch] text-[13px] text-sub">
            {query.trim()
              ? "Try a different name or email."
              : "Add an Admin, Programs Team, or Coordinator by email. They create their password on first sign-in."}
          </p>
          {!query.trim() ? (
            <div className="mt-4">
              <Button type="button" variant="primary" onClick={openCreate}>
                Add user
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <TableShell headers={["User", "Email", "Role", "Status", "Updated", "Actions"]} columns={6} endAlignLastHeader>
          <div className="divide-y divide-line">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="grid grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-6 sm:items-center"
              >
                <div className="min-w-0 sm:col-span-1">
                  <p className="truncate text-sm font-medium text-ink">{user.displayName ?? user.username}</p>
                </div>
                <p className="truncate text-xs text-sub sm:text-sm">{user.username}</p>
                <p className="text-xs font-medium capitalize text-ink sm:text-sm">
                  {roleLabel(user.role)}
                </p>
                <div>
                  <StatusPill active={user.isActive} hasPassword={user.hasPassword} />
                </div>
                <p className="hidden text-xs text-sub sm:block">{formatTimestamp(user.updatedAt)}</p>
                <div className="sm:justify-self-end">
                  <UserRowActions
                    user={user}
                    busy={isPending}
                    generatingReset={loadingResetId === user.id}
                    onGenerateResetLink={(u) => void handleGenerateResetLink(u)}
                    onEdit={openEdit}
                    onDelete={(u) => void handleDelete(u)}
                  />
                </div>
                {resetLink?.userId === user.id ? (
                  <div className="col-span-2 space-y-2 rounded-lg border border-line bg-[#fdfbfc] px-3 py-3 sm:col-span-6">
                    <p className="text-xs text-sub">
                      Single-use link, expires in 24 hours. Copy and send it to the admin out of band.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <input
                        readOnly
                        value={resetLink.url}
                        className={`${inputClass} min-w-0 flex-1 font-mono text-xs`}
                        onFocus={(event) => event.currentTarget.select()}
                      />
                      <Button type="button" variant="primary" onClick={() => void handleCopy(resetLink.url)}>
                        {resetLink.copied ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  </div>
                ) : null}
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
        title={editingUserId ? "Edit user" : "Add user"}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4 sm:px-6">
          <p className="text-sm text-sub">
            {editingUserId
              ? "Update display name, role, optional password, or active status."
              : "Add an email and choose Admin or Coordinator. They create their password on first sign-in."}
          </p>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Email</span>
            <input
              type="text"
              required
              pattern={USERNAME_PATTERN}
              value={form.username}
              onChange={(event) => handleInputChange("username", event.target.value.toLowerCase())}
              disabled={Boolean(editingUserId) || isPending}
              className={inputClass}
              autoComplete="username"
            />
            <span className="text-xs text-sub">Lowercase letters, numbers, dots, dashes, underscores, and @ only.</span>
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Role</span>
            <select
              value={form.role}
              onChange={(event) =>
                handleInputChange("role", normalizeFormRole(event.target.value))
              }
              disabled={isPending}
              className={inputClass}
            >
              <option value="admin">Admin — full workspace access including users</option>
              <option value="programs_team">
                Programs Team — full admin access except adding users; reviews contact reroutes
              </option>
              <option value="coordinator">Coordinator — forms sheet and resend only</option>
            </select>
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

          {editingUserId ? (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">New password (optional)</span>
              <div className="flex overflow-hidden rounded-lg border border-line bg-white focus-within:border-crimson focus-within:ring-1 focus-within:ring-crimson">
                <input
                  type={showPassword ? "text" : "password"}
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
              <span className="text-xs text-sub">Leave blank to keep the current password. {PASSWORD_HINT}</span>
            </label>
          ) : null}

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
              {isPending ? "Saving…" : editingUserId ? "Save changes" : "Add user"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
