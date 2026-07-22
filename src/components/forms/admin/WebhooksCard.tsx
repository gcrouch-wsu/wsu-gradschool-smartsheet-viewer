"use client";

import { Card, secondaryBtnClass } from "@/components/forms/admin/AdminCard";

export interface WebhookAdminState {
  lastWebhookAt?: string | null;
  webhookId?: number | null;
  callbackUrl?: string | null;
  secretConfigured?: boolean;
  secretSource?: "env" | "stored" | "none";
}

export interface WebhookInfo {
  webhooks?: unknown[];
  state?: WebhookAdminState;
  demo?: boolean;
}

interface WebhooksCardProps {
  webhookInfo: WebhookInfo | null;
  onRegister: () => void;
  registering?: boolean;
}

function secretLabel(state?: WebhookAdminState): string {
  if (!state?.secretConfigured) return "Not set yet (created on register)";
  if (state.secretSource === "env") return "Configured via env";
  return "Auto-managed";
}

export function WebhooksCard({ webhookInfo, onRegister, registering = false }: WebhooksCardProps) {
  const state = webhookInfo?.state;
  const smartsheetCount = webhookInfo?.webhooks?.length ?? 0;

  return (
    <Card
      title="Live sync (webhooks)"
      description="Register once for the active sheet. The app builds the callback URL and secret automatically so the grid can refresh when Smartsheet changes."
    >
      <button type="button" onClick={onRegister} disabled={registering} className={secondaryBtnClass}>
        {registering ? "Registering…" : "Register webhook for active sheet"}
      </button>
      {webhookInfo ? (
        <div className="space-y-1 text-sm text-[color:var(--wsu-muted)]">
          <p>Smartsheet webhooks: {smartsheetCount}</p>
          <p>Webhook id: {state?.webhookId ?? "none"}</p>
          <p>Callback: {state?.callbackUrl ?? "none"}</p>
          <p>Secret: {secretLabel(state)}</p>
          <p>Last event: {state?.lastWebhookAt ?? "none"}</p>
          {webhookInfo.demo ? <p>Demo mode: registration is simulated.</p> : null}
        </div>
      ) : null}
    </Card>
  );
}
