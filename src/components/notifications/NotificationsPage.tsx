"use client";

import {
  MarkAllNotificationsButton,
  NotificationsProvider,
} from "@/components/notifications/NotificationsContext";
import { NotificationsList } from "@/components/notifications/NotificationsList";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProductTourControls } from "@/components/ui/ProductTourHost";
import {
  NOTIFICATIONS_TOUR_STEPS,
  NOTIFICATIONS_TOUR_STORAGE_KEY,
} from "@/components/notifications/notifications-tour";

export function AdminNotificationsPageContent() {
  return (
    <NotificationsProvider>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Workspace"
          title="Notifications"
          description="An organized view of all workflow alerts. Open View Details for the full change summary."
          dataTour="an-heading"
          actions={
            <>
              <ProductTourControls storageKey={NOTIFICATIONS_TOUR_STORAGE_KEY} steps={NOTIFICATIONS_TOUR_STEPS} />
              <span data-tour="an-mark">
                <MarkAllNotificationsButton />
              </span>
            </>
          }
        />
        <NotificationsList />
      </div>
    </NotificationsProvider>
  );
}
