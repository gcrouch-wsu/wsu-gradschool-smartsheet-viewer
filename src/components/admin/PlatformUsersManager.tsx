"use client";

import { useMemo, useState } from "react";
import { Button, TableShell } from "@/components/admin/WorkspacePrimitives";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  ASSIGNABLE_ROLES,
  type AssignablePlatformRole,
  type PlatformUserSummary,
} from "@/lib/platform-user-types";

interface PlatformUsersManagerProps {
  bootstrapEmail: string | null;
  bootstrapLabel: string;
  initialUsers: PlatformUserSummary[];
}

interface UserFormState {
  email: string;
  displayName: string;
  password: string;
  isActive: boolean;
  roles: AssignablePlatformRole[];
}

const ROLE_LABELS: Record<AssignablePlatformRole, string> = {
  admin: "Admin",
  programs_team: "Programs Team",
  coordinator: "Coordinator",
  approver: "Approver",
  contributor: "Contributor",
  student: "Student",
};

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-crimson focus:ring-1 focus:ring-crimson";

function emptyForm(): UserFormState {
  return {
    email: "",
    displayName: "",
    password: "",
    isActive: true,
    roles: ["admin"],
  };
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function PlatformUsersManager({
  bootstrapEmail,
  bootstrapLabel,
  initialUsers,
}: PlatformUsersManagerProps) {
  const { addToast } = useToast();
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email.includes(q) ||
        (u.displayName ?? "").toLowerCase().includes(q) ||
        u.roles.some(
          (r) =>
            r.includes(q) ||
            ROLE_LABELS[r as AssignablePlatformRole]?.toLowerCase().includes(q),
        ),
    );
  }, [users, query]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
  }

  function openEdit(user: PlatformUserSummary) {
    setEditingId(user.id);
    setForm({
      email: user.email,
      displayName: user.displayName ?? "",
      password: "",
      isActive: user.isActive,
      roles: user.roles.filter((r): r is AssignablePlatformRole =>
        ASSIGNABLE_ROLES.includes(r as AssignablePlatformRole),
      ),
    });
    setFormOpen(true);
  }

  async function saveUser() {
    if (!form.email.trim()) {
      addToast("Email is required.", "error");
      return;
    }
    if (!form.roles.length) {
      addToast("Select at least one role.", "error");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        email: form.email.trim().toLowerCase(),
        displayName: form.displayName.trim() || undefined,
        roles: form.roles,
        isActive: form.isActive,
        ...(form.password ? { password: form.password } : {}),
      };
      const res = await fetch(
        editingId ? `/api/admin/platform-users/${editingId}` : "/api/admin/platform-users",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = (await res.json().catch(() => null)) as {
        user?: PlatformUserSummary;
        message?: string;
      } | null;
      if (!res.ok || !body?.user) {
        addToast(body?.message ?? "Unable to save user.", "error");
        return;
      }
      setUsers((prev) => {
        const without = prev.filter((u) => u.id !== body.user!.id);
        return [...without, body.user!].sort((a, b) =>
          (a.displayName ?? a.email).localeCompare(b.displayName ?? b.email),
        );
      });
      setFormOpen(false);
      addToast(editingId ? "User updated." : "User created.", "success");
    } finally {
      setBusy(false);
    }
  }

  async function removeUser(id: string) {
    if (!window.confirm("Remove this user account?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/platform-users/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        addToast(body?.message ?? "Unable to delete user.", "error");
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== id));
      addToast("User removed.", "success");
    } finally {
      setBusy(false);
    }
  }

  async function createResetLink(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/platform-users/${id}/reset-token`, { method: "POST" });
      const body = (await res.json().catch(() => null)) as { token?: string; message?: string } | null;
      if (!res.ok || !body?.token) {
        addToast(body?.message ?? "Unable to create reset link.", "error");
        return;
      }
      setResetUrl(`${window.location.origin}/admin/reset-password?token=${encodeURIComponent(body.token)}`);
    } finally {
      setBusy(false);
    }
  }

  function toggleRole(role: AssignablePlatformRole) {
    setForm((prev) => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role],
    }));
  }

  return (
    <div className="space-y-4">
      {bootstrapEmail ? (
        <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink">
          <span className="font-semibold">{bootstrapLabel}</span>
          <span className="text-mist"> — bootstrap owner </span>
          <span className="font-mono text-xs">{bootstrapEmail}</span>
          <span className="text-mist"> (env account, not editable here)</span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <input
          className={`${inputClass} max-w-sm`}
          placeholder="Search users…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button type="button" onClick={openCreate}>
          Add user
        </Button>
      </div>

      <TableShell>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line bg-[#faf7f8] text-xs uppercase tracking-wide text-mist">
            <tr>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Roles</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Updated</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">{user.displayName ?? user.email}</div>
                  <div className="font-mono text-xs text-mist">{user.email}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {user.roles.map((role) => (
                      <span
                        key={role}
                        className="rounded-full bg-[var(--crimson-soft)] px-2 py-0.5 text-[11px] font-medium text-crimson"
                      >
                        {ROLE_LABELS[role as AssignablePlatformRole] ?? role}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {user.isActive ? "Active" : "Inactive"}
                  {!user.hasPassword ? (
                    <span className="ml-2 text-xs text-amber-700">Pending password</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-mist">{formatTimestamp(user.updatedAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-xs font-medium text-crimson hover:underline"
                      onClick={() => openEdit(user)}
                      disabled={busy}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-xs font-medium text-ink hover:underline"
                      onClick={() => createResetLink(user.id)}
                      disabled={busy}
                    >
                      Reset link
                    </button>
                    <button
                      type="button"
                      className="text-xs font-medium text-rose-700 hover:underline"
                      onClick={() => removeUser(user.id)}
                      disabled={busy}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-mist">
                  No users match this search.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </TableShell>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editingId ? "Edit user" : "Add user"}>
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-mist">Email / username</span>
            <input
              className={inputClass}
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              disabled={Boolean(editingId)}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-mist">Display name</span>
            <input
              className={inputClass}
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-mist">
              Password {editingId ? "(leave blank to keep)" : "(optional — send reset link)"}
            </span>
            <input
              type="password"
              className={inputClass}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </label>
          <fieldset>
            <legend className="mb-2 text-sm text-mist">Roles</legend>
            <div className="grid grid-cols-2 gap-2">
              {ASSIGNABLE_ROLES.map((role) => (
                <label key={role} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.roles.includes(role)}
                    onChange={() => toggleRole(role)}
                  />
                  {ROLE_LABELS[role]}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Active
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveUser} disabled={busy || !form.email || form.roles.length === 0}>
              Save
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(resetUrl)} onClose={() => setResetUrl(null)} title="Password reset link">
        <p className="mb-3 text-sm text-mist">Share this one-time link with the user.</p>
        <input className={inputClass} readOnly value={resetUrl ?? ""} onFocus={(e) => e.target.select()} />
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            onClick={async () => {
              if (resetUrl) {
                await navigator.clipboard.writeText(resetUrl);
                addToast("Link copied.", "success");
              }
            }}
          >
            Copy
          </Button>
        </div>
      </Modal>
    </div>
  );
}
