"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { NotificationListItem } from "@/components/notifications/NotificationsList";

interface NotificationsContextValue {
  items: NotificationListItem[];
  error: string;
  loading: boolean;
  unreadCount: number;
  markingAll: boolean;
  reload: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  setItems: React.Dispatch<React.SetStateAction<NotificationListItem[]>>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<NotificationListItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const reload = useCallback(async () => {
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
    void reload();
  }, [reload]);

  const unreadCount = useMemo(() => items.filter((item) => !item.readAt).length, [items]);

  const markRead = useCallback(async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item)),
    );
  }, []);

  const markAllRead = useCallback(async () => {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      const res = await fetch("/api/notifications/read-all", { method: "POST" });
      if (!res.ok) return;
      const now = new Date().toISOString();
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? now })));
    } finally {
      setMarkingAll(false);
    }
  }, [markingAll]);

  const value = useMemo(
    () => ({
      items,
      error,
      loading,
      unreadCount,
      markingAll,
      reload,
      markRead,
      markAllRead,
      setItems,
    }),
    [items, error, loading, unreadCount, markingAll, reload, markRead, markAllRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider.");
  }
  return ctx;
}

export function MarkAllNotificationsButton({ className = "" }: { className?: string }) {
  const { unreadCount, markingAll, markAllRead } = useNotifications();
  return (
    <button
      type="button"
      onClick={() => void markAllRead()}
      disabled={unreadCount < 1 || markingAll}
      className={[
        "shrink-0 whitespace-nowrap rounded-lg border border-crimson bg-crimson px-4 py-2 text-sm font-medium !text-white hover:border-[var(--crimson-deep)] hover:bg-[var(--crimson-deep)] disabled:cursor-not-allowed disabled:border-line disabled:bg-white disabled:!text-mist disabled:hover:border-line disabled:hover:bg-white disabled:hover:!text-mist",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {markingAll ? "Marking…" : "Mark All as Read"}
    </button>
  );
}
