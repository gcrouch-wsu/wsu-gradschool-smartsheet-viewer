"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { IconCheck, IconExternalLink } from "@/components/forms/icons";

export interface NotificationListItem {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  payload?: { href?: string; fields?: Array<{ title: string; value: string }> };
}

const iconBtnClass =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[color:var(--wsu-border)] bg-white text-[color:var(--wsu-ink)] transition hover:border-[color:var(--wsu-crimson)] hover:bg-[color:var(--crimson-soft)] hover:text-[color:var(--wsu-crimson)] disabled:cursor-not-allowed disabled:opacity-50";

function formatWhen(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  return new Date(then).toLocaleString();
}

export function NotificationsList() {
  const [items, setItems] = useState<NotificationListItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const data = (await res.json()) as {
        items?: NotificationListItem[];
        message?: string;
        notice?: string;
      };
      if (!res.ok) throw new Error(data.message || "Could not load notifications.");
      setItems(data.items ?? []);
      setError(data.notice || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load notifications.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: string) {
    setMarkingId(id);
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item)),
      );
    } finally {
      setMarkingId(null);
    }
  }

  if (loading) {
    return (
      <p className="rounded-xl border border-[color:var(--wsu-border)] bg-white px-4 py-8 text-center text-sm text-[color:var(--wsu-muted)]">
        Loading…
      </p>
    );
  }

  if (error && !items.length) {
    return (
      <p className="rounded-xl border border-[color:var(--wsu-border)] bg-white px-4 py-8 text-center text-sm text-[color:var(--wsu-muted)]">
        {error}
      </p>
    );
  }

  if (!items.length) {
    return (
      <p className="rounded-xl border border-[color:var(--wsu-border)] bg-white px-4 py-10 text-center text-sm text-[color:var(--wsu-muted)]">
        You’re all caught up.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {error ? (
        <li className="rounded-lg bg-[color:var(--wsu-stone)] px-3 py-2 text-sm text-[color:var(--wsu-muted)]">{error}</li>
      ) : null}
      {items.map((item) => {
        const unread = !item.readAt;
        return (
          <li
            key={item.id}
            className={`rounded-xl border bg-white p-4 shadow-sm ${
              unread
                ? "border-[color:var(--wsu-crimson)]/25 bg-[color:var(--crimson-soft)]/20"
                : "border-[color:var(--wsu-border)]"
            }`}
          >
            <div className="flex items-start gap-4">
              <span
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                  unread ? "bg-[color:var(--wsu-crimson)]" : "bg-[color:var(--wsu-border)]"
                }`}
                aria-hidden
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-[color:var(--wsu-ink)]">{item.title}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                      unread
                        ? "bg-[color:var(--crimson-soft)] text-[color:var(--wsu-crimson)]"
                        : "bg-[color:var(--wsu-stone)] text-[color:var(--wsu-muted)]"
                    }`}
                  >
                    {unread ? "Unread" : "Read"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">{formatWhen(item.createdAt)}</p>
                {item.body ? <p className="mt-2 text-sm text-[color:var(--wsu-muted)]">{item.body}</p> : null}
                {item.payload?.fields?.length ? (
                  <dl className="mt-3 space-y-1 text-sm">
                    {item.payload.fields.map((field) => (
                      <div key={field.title} className="grid grid-cols-[minmax(0,140px)_1fr] gap-2">
                        <dt className="text-[color:var(--wsu-muted)]">{field.title}</dt>
                        <dd className="text-[color:var(--wsu-ink)]">{field.value || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:justify-end">
                {item.payload?.href ? (
                  <Link
                    href={item.payload.href}
                    className={iconBtnClass}
                    aria-label="Open row"
                    title="Open row"
                  >
                    <IconExternalLink className="h-4 w-4" />
                  </Link>
                ) : null}
                {unread ? (
                  <button
                    type="button"
                    className={iconBtnClass}
                    disabled={markingId === item.id}
                    onClick={() => void markRead(item.id)}
                    aria-label="Mark as read"
                    title="Mark as read"
                  >
                    <IconCheck className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
