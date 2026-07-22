"use client";

import { Card, primaryBtnClass, secondaryBtnClass } from "@/components/forms/admin/AdminCard";

export interface WebhookAdminState {
  lastWebhookAt?: string | null;
  webhookId?: number | null;
  sheetId?: string | null;
  callbackUrl?: string | null;
  secretConfigured?: boolean;
  secretSource?: "env" | "stored" | "none";
}

export interface WebhookListItem {
  id: number | null;
  name: string;
  enabled: boolean;
  status: string | null;
  sheetId: string | null;
  sheetName: string | null;
  callbackUrl: string | null;
  isFormsWebhook: boolean;
}

export interface WebhookActiveSheet {
  sheetId: string;
  sheetName: string | null;
  hasWebhook: boolean;
  enabledWebhook: boolean;
}

export interface WebhookInfo {
  webhooks?: WebhookListItem[];
  active?: WebhookActiveSheet | null;
  state?: WebhookAdminState;
  demo?: boolean;
}

interface WebhooksCardProps {
  webhookInfo: WebhookInfo | null;
  onRegister: () => void;
  onRefresh?: () => void;
  onSetEnabled?: (webhookId: number, enabled: boolean) => void;
  registering?: boolean;
  refreshing?: boolean;
  togglingId?: number | null;
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function StatusPill({
  ok,
  label,
}: {
  ok: boolean;
  label: string;
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        ok
          ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
          : "bg-amber-50 text-amber-950 ring-amber-200",
      ].join(" ")}
    >
      {label}
    </span>
  );
}

export function WebhooksCard({
  webhookInfo,
  onRegister,
  onRefresh,
  onSetEnabled,
  registering = false,
  refreshing = false,
  togglingId = null,
}: WebhooksCardProps) {
  const state = webhookInfo?.state;
  const active = webhookInfo?.active ?? null;
  const webhooks = webhookInfo?.webhooks ?? [];
  const formsWebhooks = webhooks.filter((w) => w.isFormsWebhook);
  const otherWebhooks = webhooks.filter((w) => !w.isFormsWebhook);
  const activeReady = Boolean(active?.enabledWebhook);
  const activeRegistered = Boolean(active?.hasWebhook);

  return (
    <Card
      title="Live sync (webhooks)"
      description="Smartsheet notifies this app when a sheet changes. Register per active form so the Sheet grid can refresh."
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--wsu-muted)]">
                Active sheet
              </p>
              {active ? (
                <>
                  <p className="truncate text-sm font-medium text-[color:var(--wsu-ink)]">
                    {active.sheetName || "Untitled form"}
                  </p>
                  <p className="font-mono text-[11px] text-[color:var(--wsu-muted)]">{active.sheetId}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {activeReady ? (
                      <StatusPill ok label="Webhook enabled" />
                    ) : activeRegistered ? (
                      <StatusPill ok={false} label="Registered, not enabled" />
                    ) : (
                      <StatusPill ok={false} label="No webhook yet" />
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-[color:var(--wsu-muted)]">
                  Select an active form on the Forms tab first.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {onRefresh ? (
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={refreshing || registering}
                  className={secondaryBtnClass}
                >
                  {refreshing ? "Refreshing…" : "Refresh status"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onRegister}
                disabled={registering || !active}
                className={primaryBtnClass}
              >
                {registering
                  ? "Registering…"
                  : activeReady
                    ? "Re-register webhook"
                    : "Register webhook"}
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2">
            <p className="text-xs text-[color:var(--wsu-muted)]">Last event received</p>
            <p className="mt-0.5 font-medium text-[color:var(--wsu-ink)]">
              {formatWhen(state?.lastWebhookAt)}
            </p>
          </div>
          <div className="rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2">
            <p className="text-xs text-[color:var(--wsu-muted)]">Callback</p>
            <p className="mt-0.5 break-all font-mono text-[11px] text-[color:var(--wsu-ink)]">
              {state?.callbackUrl ?? "Not registered yet"}
            </p>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-[color:var(--wsu-ink)]">
            Registered for forms ({formsWebhooks.length})
          </h3>
          {formsWebhooks.length === 0 ? (
            <p className="mt-2 text-sm text-[color:var(--wsu-muted)]">
              No forms webhooks found in Smartsheet yet. Register for the active sheet above.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-[color:var(--wsu-border)] overflow-hidden rounded-xl border border-[color:var(--wsu-border)] bg-white">
              {formsWebhooks.map((wh) => {
                const isActiveSheet = active?.sheetId != null && wh.sheetId === active.sheetId;
                return (
                  <li key={`${wh.id ?? "x"}-${wh.sheetId ?? "none"}`} className="px-3 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[color:var(--wsu-ink)]">
                          {wh.sheetName || "Unknown sheet"}
                          {isActiveSheet ? (
                            <span className="ml-2 text-xs font-normal text-wsu-crimson">Active</span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-[color:var(--wsu-muted)]">
                          Sheet {wh.sheetId ?? "—"} · Webhook {wh.id ?? "—"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusPill
                          ok={wh.enabled}
                          label={wh.enabled ? "Enabled" : "Disabled"}
                        />
                        {wh.status ? (
                          <span className="inline-flex rounded-full bg-[color:var(--wsu-stone)] px-2.5 py-0.5 text-xs text-[color:var(--wsu-muted)]">
                            {wh.status}
                          </span>
                        ) : null}
                        {onSetEnabled && wh.id != null ? (
                          <button
                            type="button"
                            disabled={togglingId === wh.id || registering || refreshing}
                            onClick={() => onSetEnabled(wh.id!, !wh.enabled)}
                            className={secondaryBtnClass}
                          >
                            {togglingId === wh.id
                              ? wh.enabled
                                ? "Disabling…"
                                : "Enabling…"
                              : wh.enabled
                                ? "Disable"
                                : "Enable"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {otherWebhooks.length > 0 ? (
          <p className="text-xs text-[color:var(--wsu-muted)]">
            {otherWebhooks.length} other Smartsheet webhook
            {otherWebhooks.length === 1 ? "" : "s"} on this account (not managed by Forms).
          </p>
        ) : null}

        {webhookInfo?.demo ? (
          <p className="text-xs text-[color:var(--wsu-muted)]">Demo mode: registration is simulated.</p>
        ) : null}
      </div>
    </Card>
  );
}
