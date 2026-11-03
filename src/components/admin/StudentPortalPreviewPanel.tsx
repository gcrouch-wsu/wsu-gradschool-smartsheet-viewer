"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/admin/WorkspacePrimitives";
import type { PlatformUserSummary } from "@/lib/platform-user-types";

const SUGGESTION_LIMIT = 8;

export function StudentPortalPreviewPanel({ users }: { users: PlatformUserSummary[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const studentUsers = useMemo(
    () =>
      users.filter(
        (user) => user.isActive && user.roles.includes("student") && Boolean(user.email.trim()),
      ),
    [users],
  );

  const suggestions = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return studentUsers
      .filter((user) => user.email.toLowerCase().includes(term))
      .slice(0, SUGGESTION_LIMIT);
  }, [query, studentUsers]);

  const exactMatch = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return null;
    return studentUsers.find((user) => user.email.toLowerCase() === term) ?? null;
  }, [query, studentUsers]);

  async function startPreview(event: React.FormEvent) {
    event.preventDefault();
    if (!exactMatch) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/users/student-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: exactMatch.email }),
      });
      const body = (await response.json().catch(() => null)) as {
        message?: string;
        redirectTo?: string;
      } | null;
      if (!response.ok) {
        setError(body?.message ?? "No student account uses that email.");
        return;
      }
      router.push(body?.redirectTo ?? "/student");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to start student preview.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-line bg-white p-5">
      <div>
        <h2 className="text-lg font-semibold text-ink">View student portal as</h2>
        <p className="mt-1 text-sm text-mist">
          Type a student email, pick a match, then open that student&apos;s portal in view-only mode. Your
          admin session stays signed in.
        </p>
      </div>

      <form onSubmit={(event) => void startPreview(event)} className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="relative min-w-[16rem] w-full max-w-md text-sm">
            <span className="mb-1 block text-mist">Student email</span>
            <input
              type="email"
              autoComplete="off"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
                setError(null);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => {
                window.setTimeout(() => setOpen(false), 120);
              }}
              placeholder="student@wsu.edu"
              className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink"
              aria-autocomplete="list"
              aria-expanded={open && suggestions.length > 0}
              aria-controls="student-portal-email-suggestions"
            />
            {open && suggestions.length > 0 ? (
              <ul
                id="student-portal-email-suggestions"
                role="listbox"
                className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-line bg-white shadow-sm"
              >
                {suggestions.map((user) => (
                  <li key={user.id} role="option" aria-selected={exactMatch?.id === user.id}>
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-[var(--crimson-soft)]"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setQuery(user.email);
                        setOpen(false);
                        setError(null);
                      }}
                    >
                      <span className="font-medium">{user.email}</span>
                      {user.displayName ? (
                        <span className="ml-2 text-xs text-mist">{user.displayName}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </label>

          <Button type="submit" variant="primary" disabled={busy || !exactMatch} className="shrink-0">
            {busy ? "Opening…" : "View student portal as"}
          </Button>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-rose-700">
            {error}
          </p>
        ) : null}
      </form>

      {studentUsers.length === 0 ? (
        <p className="text-sm text-mist">
          No active student accounts yet. Accounts appear here after students sign in at the student
          portal.
        </p>
      ) : null}
    </div>
  );
}
