"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { IconExternalLink } from "@/components/forms/icons";
import { useNotifications } from "@/components/notifications/NotificationsContext";
import { AppLoading } from "@/components/ui/AppLoading";
import { Modal } from "@/components/ui/Modal";
import { UnderlineTabs } from "@/components/ui/UnderlineTabs";

export interface NotificationListItem {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  payload?: {
    href?: string;
    sheetId?: string;
    rowId?: number | null;
    templateKind?: string;
    fields?: Array<{ title: string; value: string }>;
  };
}

type FilterId = "all" | "unread";

function formatExact(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  return new Date(then).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" });
}

function templateBadge(kind: string | undefined): string {
  if (!kind || kind === "alert") return "Workflow alert";
  return kind
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function NotificationsList() {
  const { items, error, loading, unreadCount, markRead } = useNotifications();
  const [filter, setFilter] = useState<FilterId>("all");
  const [detailId, setDetailId] = useState<string | null>(null);

  const visibleItems = useMemo(() => {
    if (filter === "unread") return items.filter((item) => !item.readAt);
    return items;
  }, [filter, items]);

  const detailItem = useMemo(
    () => (detailId ? items.find((item) => item.id === detailId) ?? null : null),
    [detailId, items],
  );

  async function openDetails(item: NotificationListItem) {
    setDetailId(item.id);
    if (!item.readAt) {
      await markRead(item.id);
    }
  }

  if (loading) {
    return <AppLoading label="Loading notifications" />;
  }

  if (error && !items.length) {
    return (
      <p className="rounded-xl border border-line bg-white px-4 py-8 text-center text-sm text-sub">{error}</p>
    );
  }

  return (
    <div className="space-y-5">
      <UnderlineTabs
        items={[
          { id: "all", label: "All notifications" },
          { id: "unread", label: unreadCount ? `Unread notifications (${unreadCount})` : "Unread notifications" },
        ]}
        value={filter}
        onChange={setFilter}
        ariaLabel="Notification filters"
      />

      {error ? <p className="rounded-lg bg-[color:var(--wsu-stone)] px-3 py-2 text-sm text-sub">{error}</p> : null}

      {!visibleItems.length ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-[#fdfbfc] px-5 py-12 text-center">
          <p className="text-sm font-medium text-ink">
            {filter === "unread" ? "No unread notifications" : "You’re all caught up"}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-sub">
            {filter === "unread"
              ? "Switch to All notifications to review earlier alerts."
              : "Alerts from sheet workflows will show up here."}
          </p>
          {filter === "unread" && items.length > 0 ? (
            <button
              type="button"
              className="mt-4 text-sm font-medium text-crimson hover:underline"
              onClick={() => setFilter("all")}
            >
              View all notifications
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-3">
          {visibleItems.map((item) => {
            const unread = !item.readAt;
            return (
              <li
                key={item.id}
                className={`rounded-xl border bg-white px-4 py-4 shadow-sm sm:px-5 ${
                  unread ? "border-crimson/20" : "border-line"
                }`}
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                      unread ? "bg-crimson" : "bg-line-strong"
                    }`}
                    aria-hidden
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`text-sm text-ink ${unread ? "font-semibold" : "font-medium"}`}>{item.title}</p>
                      <span className="rounded-full bg-[color:var(--wsu-stone)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sub">
                        {templateBadge(item.payload?.templateKind)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-sub">{formatExact(item.createdAt)}</p>
                    {item.body ? (
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-sub">{item.body}</p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => void openDetails(item)}
                    className="inline-flex shrink-0 items-center gap-1.5 self-center rounded-lg border border-line bg-white px-3 py-2 text-xs font-medium text-ink hover:border-crimson hover:text-crimson"
                  >
                    <IconExternalLink className="h-3.5 w-3.5" />
                    View Details
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={Boolean(detailItem)}
        onClose={() => setDetailId(null)}
        title={detailItem?.title ?? "Notification"}
        description={detailItem ? formatExact(detailItem.createdAt) : undefined}
        size="lg"
      >
        {detailItem ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[color:var(--wsu-stone)] px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-sub">
                {templateBadge(detailItem.payload?.templateKind)}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${
                  detailItem.readAt
                    ? "bg-[color:var(--wsu-stone)] text-sub"
                    : "bg-[color:var(--crimson-soft)] text-crimson"
                }`}
              >
                {detailItem.readAt ? "Read" : "Unread"}
              </span>
            </div>

            {detailItem.body ? (
              <p className="text-sm leading-relaxed text-ink">{detailItem.body}</p>
            ) : (
              <p className="text-sm text-sub">No additional message was included with this alert.</p>
            )}

            {Array.isArray(detailItem.payload?.fields) && detailItem.payload.fields.length > 0 ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-mist">Included fields</h3>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  {detailItem.payload.fields
                    .filter((field) => field.value)
                    .map((field) => (
                      <div
                        key={`${detailItem.id}-${field.title}`}
                        className="rounded-lg border border-line bg-[#fdfbfc] px-3 py-2.5"
                      >
                        <dt className="text-[11px] font-medium uppercase tracking-wide text-mist">{field.title}</dt>
                        <dd className="mt-1 break-words text-sm text-ink">{field.value}</dd>
                      </div>
                    ))}
                </dl>
              </div>
            ) : null}

            {(detailItem.payload?.sheetId || detailItem.payload?.rowId != null) && (
              <p className="text-xs text-sub">
                {detailItem.payload.sheetId ? `Sheet ID: ${detailItem.payload.sheetId}` : null}
                {detailItem.payload.sheetId && detailItem.payload.rowId != null ? " · " : null}
                {detailItem.payload.rowId != null ? `Row ${detailItem.payload.rowId}` : null}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => setDetailId(null)}
                className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-ink hover:border-mist"
              >
                Close
              </button>
              {detailItem.payload?.href ? (
                <Link
                  href={detailItem.payload.href}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-crimson bg-crimson px-4 py-2 text-sm font-medium text-white hover:border-[var(--crimson-deep)] hover:bg-[var(--crimson-deep)]"
                  onClick={() => setDetailId(null)}
                >
                  <IconExternalLink className="h-4 w-4" />
                  Open related row
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
