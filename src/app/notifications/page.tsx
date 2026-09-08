"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { primaryBtnClass, secondaryBtnClass } from "@/components/forms/admin/AdminCard";

interface Item {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  payload?: { href?: string; fields?: Array<{ title: string; value: string }> };
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/notifications");
    const data = (await res.json()) as { items?: Item[]; message?: string; notice?: string };
    if (!res.ok) throw new Error(data.message || "Could not load notifications.");
    setItems(data.items ?? []);
    if (data.notice) setError(data.notice);
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load notifications."));
  }, []);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    setItems((current) => current.map((item) => (item.id === id ? { ...item, readAt: new Date().toISOString() } : item)));
  }

  return (
    <main className="min-h-screen bg-[color:var(--wsu-stone,#f7f5f2)] px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--wsu-crimson)]">Graduate School</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[color:var(--wsu-ink)]">Notifications</h1>
        <p className="mt-2 text-sm text-[color:var(--wsu-muted)]">Unread alerts from sheet workflows. Email delivery is a later plan.</p>
        {error ? <p className="mt-4 rounded-lg bg-[color:var(--wsu-stone)] px-3 py-2 text-sm text-[color:var(--wsu-muted)]">{error}</p> : null}
        {!items.length ? (
          <p className="mt-6 rounded-xl border border-[color:var(--wsu-border)] bg-white px-4 py-10 text-center text-sm text-[color:var(--wsu-muted)]">
            You’re all caught up.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {items.map((item) => (
              <li key={item.id} className="rounded-xl border border-[color:var(--wsu-border)] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-[color:var(--wsu-ink)]">{item.title}</p>
                    <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.readAt ? "bg-[color:var(--wsu-stone)] text-[color:var(--wsu-muted)]" : "bg-emerald-50 text-emerald-800"}`}>
                    {item.readAt ? "Read" : "Unread"}
                  </span>
                </div>
                {item.body ? <p className="mt-2 text-sm text-[color:var(--wsu-muted)]">{item.body}</p> : null}
                {item.payload?.fields?.length ? (
                  <dl className="mt-3 space-y-1 text-sm">
                    {item.payload.fields.map((field) => (
                      <div key={field.title} className="grid grid-cols-[140px_1fr] gap-2">
                        <dt className="text-[color:var(--wsu-muted)]">{field.title}</dt>
                        <dd className="text-[color:var(--wsu-ink)]">{field.value || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.payload?.href ? (
                    <Link href={item.payload.href} className={primaryBtnClass}>Open row</Link>
                  ) : null}
                  {!item.readAt ? (
                    <button type="button" className={secondaryBtnClass} onClick={() => void markRead(item.id)}>Mark as read</button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
