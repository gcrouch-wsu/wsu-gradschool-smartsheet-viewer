"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { EmptyState } from "@/components/admin/WorkspacePrimitives";
import { EdgeDrawer } from "@/components/ui/EdgeDrawer";
import { SES_EVENT_KINDS, SES_EVENT_LABELS, SES_EVENT_MEANINGS, type SesEventKind } from "@/lib/ses/events";
import type { SesEventRecord } from "@/lib/ses/store";

function listHref(kind: SesEventKind | null, query: string): string {
  const params = new URLSearchParams();
  params.set("tab", "email");
  if (kind) params.set("kind", kind);
  if (query.trim()) params.set("q", query.trim());
  return `/admin/activity?${params.toString()}`;
}

export function EmailDeliveryPanel({
  events,
  counts,
  kind,
  query,
  page,
  available,
  webhookUrl,
}: {
  events: SesEventRecord[];
  counts: Record<SesEventKind, number>;
  kind: SesEventKind | null;
  query: string;
  page: number;
  available: boolean;
  webhookUrl: string;
}) {
  const router = useRouter();
  const [draftQuery, setDraftQuery] = useState(query);
  const [rows, setRows] = useState(events);
  const [totals, setTotals] = useState(counts);
  const [dbAvailable, setDbAvailable] = useState(available);
  const [selected, setSelected] = useState<SesEventRecord | null>(null);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const basePath = listHref(kind, query);
  const meaning = selected?.kind ? SES_EVENT_MEANINGS[selected.kind] : "Amazon SES reported this message event.";

  useEffect(() => {
    setRows(events);
    setTotals(counts);
    setDbAvailable(available);
  }, [events, counts, available]);

  async function refreshEvents() {
    setRefreshing(true);
    setRefreshError("");
    try {
      const params = new URLSearchParams();
      if (kind) params.set("kind", kind);
      if (query.trim()) params.set("q", query.trim());
      const qs = params.toString();
      const response = await fetch(`/api/admin/ses-events${qs ? `?${qs}` : ""}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not refresh email events.");
      const data = (await response.json()) as {
        available: boolean;
        events: SesEventRecord[];
        counts: Record<SesEventKind, number>;
      };
      setRows(data.events);
      setTotals(data.counts);
      setDbAvailable(data.available);
      setSelected((current) => data.events.find((event) => event.id === current?.id) ?? current);
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "Could not refresh email events.");
    } finally {
      setRefreshing(false);
    }
  }

  function applySearch(event: React.FormEvent) {
    event.preventDefault();
    router.push(listHref(kind, draftQuery));
  }

  async function copyWebhook() {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 text-sm text-sub">
          SES event destination endpoint{" "}
          <code className="break-all rounded bg-[#f7f3f4] px-1.5 py-0.5 text-xs text-ink">{webhookUrl}</code>
        </p>
        <button
          type="button"
          onClick={() => void copyWebhook()}
          className="shrink-0 rounded-lg border border-line-strong bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-[#faf7f8]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {!dbAvailable ? (
        <p className="rounded-xl border border-line bg-[#fdfbfc] px-4 py-3 text-sm text-sub">
          Email events are stored in Postgres. Set DATABASE_URL to record them.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {SES_EVENT_KINDS.map((item) => {
          const active = kind === item;
          return (
            <Link
              key={item}
              href={listHref(active ? null : item, query)}
              aria-current={active ? "page" : undefined}
              className={[
                "rounded-xl border px-4 py-3 text-left transition",
                active ? "border-crimson bg-[var(--crimson-soft)]" : "border-line bg-white hover:border-mist",
              ].join(" ")}
            >
              <p className="text-xs text-sub">{SES_EVENT_LABELS[item]}</p>
              <p className="mt-1 text-2xl font-medium tracking-tight text-ink">{totals[item]}</p>
            </Link>
          );
        })}
      </div>

      <form onSubmit={applySearch} className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="ses-event-search">
          Search email events
        </label>
        <input
          id="ses-event-search"
          type="search"
          value={draftQuery}
          onChange={(event) => setDraftQuery(event.target.value)}
          placeholder="Recipient, sender, subject, or message id"
          className="min-w-[16rem] flex-1 rounded-lg border border-line-strong px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-lg bg-crimson px-4 py-2 text-sm font-medium text-white">
          Search
        </button>
        <button
          type="button"
          onClick={() => void refreshEvents()}
          disabled={refreshing}
          className="rounded-lg border border-line-strong bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-[#faf7f8] disabled:opacity-60"
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </form>
      {refreshError ? (
        <p role="status" className="text-sm text-crimson">
          {refreshError}
        </p>
      ) : null}

      <AdminDataTable
        headers={["When", "Type", "Recipient", "Subject", "Outcome"]}
        items={rows}
        page={page}
        basePath={basePath}
        getRowKey={(event) => event.id}
        empty={
          <EmptyState
            icon={<span className="font-serif text-lg">✉</span>}
            title={kind || query.trim() ? "No matching email events" : "No email events yet"}
            description={
              kind || query.trim()
                ? "Try another type or clear the search."
                : "Publish sends, bounces, complaints, delays, and the other SES event types to the endpoint above."
            }
            variant="panel"
          />
        }
        renderRow={(event) => (
          <>
            <p className="min-w-0 text-sm text-sub">{new Date(event.occurredAt).toLocaleString()}</p>
            <p className="min-w-0 text-sm text-ink">{event.kind ? SES_EVENT_LABELS[event.kind] : event.eventType}</p>
            <p className="min-w-0 break-all text-sm text-ink">{event.recipientEmail}</p>
            <p className="min-w-0 text-sm text-sub">{event.subject || "—"}</p>
            <div className="min-w-0">
              <p className="text-sm text-ink">{event.outcome}</p>
              <button
                type="button"
                className="mt-1 text-xs font-medium text-crimson hover:underline"
                onClick={() => setSelected(event)}
              >
                View
              </button>
            </div>
          </>
        )}
      />

      <EdgeDrawer open={selected !== null} onClose={() => setSelected(null)} labelledBy="ses-event-title" lightDismiss>
        {selected ? (
          <div className="flex h-full min-h-0 w-full flex-col bg-white">
            <div className="border-b border-line px-6 py-5">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-crimson">Email delivery</p>
              <h3 id="ses-event-title" className="mt-2 text-2xl font-medium text-ink">
                {selected.kind ? SES_EVENT_LABELS[selected.kind] : selected.eventType}
              </h3>
              <p className="mt-2 text-sm leading-6 text-sub">{meaning}</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <dl className="space-y-4 text-sm">
                {[
                  ["Recipient", selected.recipientEmail],
                  ["Sender", selected.senderEmail || "—"],
                  ["Subject", selected.subject || "—"],
                  ["Message id", selected.messageId],
                  ["When", new Date(selected.occurredAt).toLocaleString()],
                  ["Detail", selected.outcome],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-medium uppercase tracking-wide text-mist">{label}</dt>
                    <dd className="mt-1 break-all text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
              <h4 className="mt-6 text-xs font-medium uppercase tracking-wide text-mist">SES payload</h4>
              <pre className="mt-2 max-h-80 overflow-auto rounded-xl bg-[#f7f3f4] p-3 text-xs leading-5 text-ink">
                {JSON.stringify(selected.payload, null, 2)}
              </pre>
            </div>
          </div>
        ) : null}
      </EdgeDrawer>
    </div>
  );
}
