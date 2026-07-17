"use client";

import { Card, secondaryBtnClass } from "@/components/forms/admin/AdminCard";

interface WebhookInfo {
  webhooks?: unknown[];
  state?: { lastWebhookAt?: string };
}

interface WebhooksCardProps {
  webhookInfo: WebhookInfo | null;
  onRegister: () => void;
}

export function WebhooksCard({ webhookInfo, onRegister }: WebhooksCardProps) {
  return (
    <Card
      title="Live sync (webhooks)"
      description="Register a webhook so the tracker refreshes when Smartsheet changes. Set WEBHOOK_CALLBACK_URL in .env for production."
    >
      <button type="button" onClick={onRegister} className={secondaryBtnClass}>
        Register webhook for active sheet
      </button>
      {webhookInfo ? (
        <div className="text-sm text-[color:var(--wsu-muted)]">
          <p>Registered webhooks: {webhookInfo.webhooks?.length ?? 0}</p>
          <p>Last webhook: {webhookInfo.state?.lastWebhookAt ?? "none"}</p>
        </div>
      ) : null}
    </Card>
  );
}
