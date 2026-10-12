"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert } from "@/components/forms/admin/AdminCard";
import type { AdminTab } from "@/components/forms/admin/AdminSectionNav";
import {
  FORMS_MANAGE_TOUR_STEPS,
  FORMS_MANAGE_TOUR_STORAGE_KEY,
} from "@/components/forms/admin/forms-manage-tour";
import { WebhooksCard, type WebhookInfo } from "@/components/forms/admin/WebhooksCard";
import { FormsWorkspaceChrome } from "@/components/forms/layout/FormsWorkspaceChrome";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ProductTour } from "@/components/ui/ProductTour";
import { TourHowToButton } from "@/components/ui/ProductTourHost";
import { useProductTour } from "@/hooks/useProductTour";

export default function ManagePage() {
  return (
    <Suspense
      fallback={
        <FormsWorkspaceChrome>
          <p className="text-sm text-[color:var(--wsu-muted)]">Loading…</p>
        </FormsWorkspaceChrome>
      }
    >
      <ManagePageContent />
    </Suspense>
  );
}

function ManagePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tour = useProductTour(FORMS_MANAGE_TOUR_STORAGE_KEY);

  const [formsError, setFormsError] = useState("");
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null);
  const [webhookRegistering, setWebhookRegistering] = useState(false);
  const [webhookRefreshing, setWebhookRefreshing] = useState(false);
  const [webhookTogglingId, setWebhookTogglingId] = useState<number | null>(null);
  const [webhookDeletingId, setWebhookDeletingId] = useState<number | null>(null);
  const [deleteWebhookId, setDeleteWebhookId] = useState<number | null>(null);

  useEffect(() => {
    // Forms list moved to /admin/sources — this page is webhooks-only.
    if (tabParam && tabParam !== "webhooks") {
      router.replace("/admin/sources");
      return;
    }
    void loadWebhooks();
  }, [tabParam, router]);

  function handleSectionSelect(id: AdminTab) {
    router.replace(`/forms/manage?tab=${id}`);
  }

  async function loadWebhooks(opts?: { silent?: boolean }) {
    if (!opts?.silent) setWebhookRefreshing(true);
    try {
      const r = await fetch("/api/forms/webhooks");
      const d = await r.json();
      if (r.ok) setWebhookInfo(d);
      else if (!opts?.silent) setFormsError(d.error || d.message || "Could not load webhooks.");
    } finally {
      if (!opts?.silent) setWebhookRefreshing(false);
    }
  }

  async function registerWebhook() {
    setWebhookRegistering(true);
    setFormsError("");
    try {
      const r = await fetch("/api/forms/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const d = await r.json();
      if (!r.ok) setFormsError(d.error || d.message || "Webhook registration failed.");
      else await loadWebhooks({ silent: true });
    } finally {
      setWebhookRegistering(false);
    }
  }

  async function setWebhookEnabled(webhookId: number, enabled: boolean) {
    setWebhookTogglingId(webhookId);
    setFormsError("");
    try {
      const r = await fetch(`/api/forms/webhooks/${encodeURIComponent(String(webhookId))}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const d = await r.json();
      if (!r.ok) {
        setFormsError(d.error || d.message || `Could not ${enabled ? "enable" : "disable"} webhook.`);
        return;
      }
      await loadWebhooks({ silent: true });
    } finally {
      setWebhookTogglingId(null);
    }
  }

  function openDeleteWebhookModal(webhookId: number) {
    setDeleteWebhookId(webhookId);
    setFormsError("");
  }

  function closeDeleteWebhookModal() {
    if (webhookDeletingId != null) return;
    setDeleteWebhookId(null);
  }

  async function confirmDeleteWebhook() {
    const webhookId = deleteWebhookId;
    if (webhookId == null) return;

    setWebhookDeletingId(webhookId);
    setFormsError("");
    try {
      const r = await fetch(`/api/forms/webhooks/${encodeURIComponent(String(webhookId))}`, {
        method: "DELETE",
      });
      const d = await r.json();
      if (!r.ok) {
        setFormsError(d.error || d.message || "Could not delete webhook.");
        return;
      }
      setDeleteWebhookId(null);
      await loadWebhooks({ silent: true });
    } finally {
      setWebhookDeletingId(null);
    }
  }

  if (tabParam && tabParam !== "webhooks") {
    return (
      <FormsWorkspaceChrome>
        <p className="text-sm text-[color:var(--wsu-muted)]">Redirecting to Sources…</p>
      </FormsWorkspaceChrome>
    );
  }

  return (
    <FormsWorkspaceChrome
      activeTab="webhooks"
      onSelectTab={handleSectionSelect}
      actions={<TourHowToButton onClick={tour.startTour} />}
    >
      {formsError ? <Alert text={formsError} /> : null}

      <WebhooksCard
        webhookInfo={webhookInfo}
        onRegister={registerWebhook}
        onRefresh={() => void loadWebhooks()}
        onSetEnabled={(id, enabled) => void setWebhookEnabled(id, enabled)}
        onDelete={openDeleteWebhookModal}
        registering={webhookRegistering}
        refreshing={webhookRefreshing}
        togglingId={webhookTogglingId}
        deletingId={webhookDeletingId}
      />

      <ConfirmModal
        open={deleteWebhookId != null}
        onClose={closeDeleteWebhookModal}
        onConfirm={() => void confirmDeleteWebhook()}
        title="Delete webhook"
        message="Are you sure you want to delete this webhook? Smartsheet will stop notifying this app for that sheet until you register again. This cannot be undone."
        confirmLabel="Delete webhook"
        danger
        busy={webhookDeletingId != null}
        busyLabel="Deleting…"
      />

      <ProductTour
        open={tour.open}
        steps={FORMS_MANAGE_TOUR_STEPS}
        stepIndex={tour.stepIndex}
        onStepIndexChange={tour.setStepIndex}
        onClose={tour.closeTour}
        onComplete={tour.completeTour}
      />
    </FormsWorkspaceChrome>
  );
}
