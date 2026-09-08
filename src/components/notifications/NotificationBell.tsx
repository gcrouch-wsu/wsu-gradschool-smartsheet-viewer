"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconBell } from "@/components/forms/icons";

export function NotificationBell({ className = "" }: { className?: string }) {
  const [count, setCount] = useState(0);

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

  return (
    <Link
      href="/notifications"
      className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-line-strong bg-white text-ink hover:border-crimson ${className}`}
      aria-label={count ? `${count} unread notifications` : "Notifications"}
    >
      <IconBell className="h-4 w-4" />
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-wsu-crimson px-1 text-center text-[10px] font-semibold leading-4 text-white">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  );
}
