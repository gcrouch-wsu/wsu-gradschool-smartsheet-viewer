"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { IconBell, IconChevronDown, IconChevronUp } from "@/components/forms/icons";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  payload?: { href?: string; fields?: Array<{ title: string; value: string }> };
}

function formatRelativeTime(iso: string, nowMs = Date.now()): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const seconds = Math.max(0, Math.floor((nowMs - then) / 1000));
  if (seconds < 10) return "few sec ago";
  if (seconds < 60) return `${seconds} sec ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(then).toLocaleString();
}

export function NotificationBell({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/notifications");
      const data = (await res.json()) as {
        items?: NotificationItem[];
        unreadCount?: number;
        message?: string;
        notice?: string;
      };
      if (!res.ok) throw new Error(data.message || "Could not load notifications.");
      setItems(data.items ?? []);
      setCount(Number(data.unreadCount ?? 0));
      if (data.notice) setError(data.notice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load notifications.");
      setItems([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications")
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data: { unreadCount?: number } | null) => {
        if (!cancelled) setCount(Number(data?.unreadCount ?? 0));
      })
      .catch(() => {
        if (!cancelled) setCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item)),
    );
    setCount((current) => Math.max(0, current - 1));
  }

  function toggleExpanded(item: NotificationItem) {
    const next = expandedId === item.id ? null : item.id;
    setExpandedId(next);
    if (next && !item.readAt) void markRead(item.id);
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-line-strong bg-white text-ink hover:border-crimson"
        aria-label={count ? `${count} unread notifications` : "Notifications"}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <IconBell className="h-4 w-4" />
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-wsu-crimson px-1 text-center text-[10px] font-semibold leading-4 text-white">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-[10050] mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-xl border border-[color:var(--wsu-border)] bg-white shadow-[0_12px_32px_rgba(35,31,32,0.16)]"
        >
          <div className="flex items-center justify-between border-b border-[color:var(--wsu-border)] px-3 py-2.5">
            <p className="text-sm font-medium text-[color:var(--wsu-ink)]">Notifications</p>
            <span className="text-xs text-[color:var(--wsu-muted)]">{count} unread</span>
          </div>

          <div className="max-h-80 overflow-y-auto overscroll-contain">
            {loading ? (
              <p className="px-3 py-8 text-center text-sm text-[color:var(--wsu-muted)]">Loading…</p>
            ) : error && !items.length ? (
              <p className="px-3 py-8 text-center text-sm text-[color:var(--wsu-muted)]">{error}</p>
            ) : !items.length ? (
              <p className="px-3 py-8 text-center text-sm text-[color:var(--wsu-muted)]">You’re all caught up.</p>
            ) : (
              <ul>
                {items.map((item) => {
                  const expanded = expandedId === item.id;
                  const unread = !item.readAt;
                  return (
                    <li
                      key={item.id}
                      className={`border-b border-[color:var(--wsu-border)] last:border-b-0 ${
                        unread ? "bg-[color:var(--crimson-soft)]/35" : "bg-white"
                      }`}
                    >
                      <button
                        type="button"
                        className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-[color:var(--wsu-stone)]/50"
                        onClick={() => toggleExpanded(item)}
                        aria-expanded={expanded}
                      >
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                            unread ? "bg-wsu-crimson" : "bg-[color:var(--wsu-border)]"
                          }`}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium text-[color:var(--wsu-ink)]">{item.title}</span>
                            <span className="flex shrink-0 items-center gap-1 text-[color:var(--wsu-muted)]">
                              <span className="whitespace-nowrap text-[11px]">{formatRelativeTime(item.createdAt)}</span>
                              {expanded ? (
                                <IconChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <IconChevronDown className="h-3.5 w-3.5" />
                              )}
                            </span>
                          </span>
                          {!expanded && item.body ? (
                            <span className="mt-0.5 line-clamp-1 block text-xs text-[color:var(--wsu-muted)]">
                              {item.body}
                            </span>
                          ) : null}
                          {expanded ? (
                            <span className="mt-2 block space-y-2">
                              {item.body ? (
                                <span className="block text-sm text-[color:var(--wsu-muted)]">{item.body}</span>
                              ) : null}
                              {item.payload?.href ? (
                                <Link
                                  href={item.payload.href}
                                  className="inline-flex text-xs font-medium text-[color:var(--wsu-crimson)] hover:underline"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  Open row
                                </Link>
                              ) : null}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-[color:var(--wsu-border)] px-3 py-2.5 text-center">
            <Link
              href="/notifications"
              className="text-xs font-medium text-[color:var(--wsu-muted)] hover:text-[color:var(--wsu-crimson)]"
              onClick={() => setOpen(false)}
            >
              Read all notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
