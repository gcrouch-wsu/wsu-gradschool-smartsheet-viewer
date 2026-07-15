"use client";

import { useState } from "react";
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
const PASSWORD_HINT = "At least 8 characters, with one uppercase letter, one number, and one special character such as !, *, or _.";

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
  if (!payload?.errors?.length) {
    return lead;
  }

  return `${lead} ${payload.errors.join(" ")}`;
}

export function AdminUsersManager({ bootstrapUser, initialUsers, ownerLabel, storageMode }: AdminUsersManagerProps) {
  const toast = useToast();
  const [users, setUsers] = useState(() => sortUsers(initialUsers));
  const [form, setForm] = useState<UserFormState>(() => emptyForm());
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const storageLabel = storageMode === "database" ? "Postgres" : "local config files";
  const storageDescription = storageMode === "database"
    ? "These users are stored in Postgres and can sign in without changing environment variables. This is the recommended mode for production deployments."
    : "These users are stored in the app's local config files and can sign in without changing environment variables. For Railway or any production deployment where local files are not durable, switch to Postgres by setting DATABASE_URL.";
  const passwordStorageDescription = storageMode === "database"
    ? "Passwords are hashed before they are written to Postgres. Use this form to provision or rotate admin credentials."
    : "Passwords are hashed before they are written to local config files. Use this form to provision or rotate admin credentials.";

  function resetForm() {
    setEditingUserId(null);
    setForm(emptyForm());
    setShowPassword(false);
  }

  function handleInputChange<Key extends keyof UserFormState>(key: Key, value: UserFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleEdit(user: ManagedAdminUserSummary) {
    setEditingUserId(user.id);
    setForm({
      username: user.username,
      displayName: user.displayName ?? "",
      password: "",
      isActive: user.isActive,
    });
    setShowPassword(false);
    setError(null);
    setSuccess(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    setSuccess(null);

    const endpoint = editingUserId ? `/api/admin/users/${editingUserId}` : "/api/admin/users";
    const method = editingUserId ? "PUT" : "POST";

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
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
      setUsers((current) =>
        sortUsers([
          ...current.filter((user) => user.id !== savedUser.id),
          savedUser,
        ]),
      );
      const successMsg = editingUserId ? "Admin user updated." : "Admin user created.";
      setSuccess(successMsg);
      toast.addToast(successMsg, "success");
      resetForm();
    } catch {
      setError("Unable to save the admin user.");
      toast.addToast("Unable to save the admin user.", "error");
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete(user: ManagedAdminUserSummary) {
    const confirmed = window.confirm(`Delete admin account ${user.displayName ?? user.username}?`);
    if (!confirmed) {
      return;
    }

    setIsPending(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as { message?: string; error?: string; errors?: string[] } | null;
      if (!response.ok) {
        const msg = buildErrorMessage(payload);
        setError(msg);
        toast.addToast(msg, "error");
        return;
      }

      setUsers((current) => current.filter((entry) => entry.id !== user.id));
      if (editingUserId === user.id) {
        resetForm();
      }
      setSuccess("Admin user deleted.");
      toast.addToast("Admin user deleted.", "success");
    } catch {
      setError("Unable to delete the admin user.");
      toast.addToast("Unable to delete the admin user.", "error");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <section className="space-y-4">
        <article className="rounded-[1.75rem] border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] p-6 shadow-[0_16px_40px_rgba(35,31,32,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--wsu-crimson)]">Owner access</p>
          <h2 className="mt-2 text-2xl font-semibold text-[color:var(--wsu-ink)]">Bootstrap owner</h2>
          <p className="mt-2 text-sm text-[color:var(--wsu-muted)]">
            {ownerLabel} can sign in with the environment-configured owner account and manage additional admins from here.
          </p>
          <div className="mt-4 rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-4 text-sm text-[color:var(--wsu-muted)]">
            <p><span className="font-semibold text-[color:var(--wsu-ink)]">Username:</span> {bootstrapUser?.username ?? "Not configured"}</p>
            <p className="mt-2">This account is read-only in the UI and still comes from environment variables.</p>
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] p-6 shadow-[0_16px_40px_rgba(35,31,32,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--wsu-crimson)]">Managed access</p>
              <h2 className="mt-2 text-2xl font-semibold text-[color:var(--wsu-ink)]">Additional admins</h2>
              <p className="mt-2 text-sm text-[color:var(--wsu-muted)]">{storageDescription}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-[color:var(--wsu-border)] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">{storageLabel}</span>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-[color:var(--wsu-border)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--wsu-muted)] hover:border-[color:var(--wsu-crimson)] hover:text-[color:var(--wsu-crimson)]"
              >
                New admin
              </button>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {users.map((user) => (
              <article key={user.id} className="rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--wsu-crimson)]">{user.isActive ? "Active" : "Inactive"}</p>
                    <h3 className="mt-1 text-lg font-semibold text-[color:var(--wsu-ink)]">{user.displayName ?? user.username}</h3>
                    <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">Username: {user.username}</p>
                    <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">Updated: {formatTimestamp(user.updatedAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(user)}
                      className="rounded-full border border-[color:var(--wsu-border)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--wsu-muted)] hover:border-[color:var(--wsu-crimson)] hover:text-[color:var(--wsu-crimson)]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(user)}
                      disabled={isPending}
                      className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {users.length === 0 && <p className="text-sm text-[color:var(--wsu-muted)]">No managed admins yet.</p>}
          </div>
        </article>
      </section>

      <section className="rounded-[1.75rem] border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] p-6 shadow-[0_16px_40px_rgba(35,31,32,0.06)]">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--wsu-crimson)]">{editingUserId ? "Edit admin" : "Add admin"}</p>
        <h2 className="mt-2 text-2xl font-semibold text-[color:var(--wsu-ink)]">{editingUserId ? "Update managed admin" : "Create managed admin"}</h2>
        <p className="mt-2 text-sm text-[color:var(--wsu-muted)]">{passwordStorageDescription}</p>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[color:var(--wsu-ink)]">Username</span>
            <input
              type="text"
              required
              pattern={USERNAME_PATTERN}
              value={form.username}
              onChange={(event) => handleInputChange("username", event.target.value.toLowerCase())}
              className="w-full rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-3 text-base text-[color:var(--wsu-ink)] outline-none transition focus:border-[color:var(--wsu-crimson)] focus:ring-2 focus:ring-[color:rgba(166,15,45,0.12)]"
            />
            <p className="text-xs text-[color:var(--wsu-muted)]">Lowercase letters, numbers, dots, dashes, underscores, and @ only.</p>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[color:var(--wsu-ink)]">Display name</span>
            <input
              type="text"
              value={form.displayName}
              onChange={(event) => handleInputChange("displayName", event.target.value)}
              className="w-full rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-3 text-base text-[color:var(--wsu-ink)] outline-none transition focus:border-[color:var(--wsu-crimson)] focus:ring-2 focus:ring-[color:rgba(166,15,45,0.12)]"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[color:var(--wsu-ink)]">Password</span>
            <div className="flex overflow-hidden rounded-2xl border border-[color:var(--wsu-border)] bg-white focus-within:border-[color:var(--wsu-crimson)] focus-within:ring-2 focus-within:ring-[color:rgba(166,15,45,0.12)]">
              <input
                type={showPassword ? "text" : "password"}
                required={!editingUserId}
                value={form.password}
                onChange={(event) => handleInputChange("password", event.target.value)}
                className="w-full px-4 py-3 text-base text-[color:var(--wsu-ink)] outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="border-l border-[color:var(--wsu-border)] px-4 text-sm font-medium text-[color:var(--wsu-crimson)] transition hover:bg-[color:rgba(166,15,45,0.05)]"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <p className="text-xs text-[color:var(--wsu-muted)]">{editingUserId ? `Leave blank to keep the current password. ${PASSWORD_HINT}` : PASSWORD_HINT}</p>
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-3 text-sm text-[color:var(--wsu-ink)]">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => handleInputChange("isActive", event.target.checked)}
              className="h-4 w-4 rounded border-[color:var(--wsu-border)] text-[color:var(--wsu-crimson)] focus:ring-[color:var(--wsu-crimson)]"
            />
            Allow this admin to sign in
          </label>

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {success}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-full bg-[color:var(--wsu-crimson)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--wsu-crimson-dark)] disabled:cursor-not-allowed disabled:bg-[color:rgba(166,15,45,0.45)]"
            >
              {isPending ? "Saving..." : editingUserId ? "Save admin" : "Create admin"}
            </button>
            {editingUserId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-[color:var(--wsu-border)] bg-white px-5 py-3 text-sm font-medium text-[color:var(--wsu-muted)] hover:border-[color:var(--wsu-crimson)] hover:text-[color:var(--wsu-crimson)]"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
