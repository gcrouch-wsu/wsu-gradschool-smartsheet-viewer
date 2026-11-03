"use client";

import {
  MarkAllNotificationsButton,
  NotificationsProvider,
} from "@/components/notifications/NotificationsContext";
import { NotificationsList } from "@/components/notifications/NotificationsList";
import { PageHeader } from "@/components/layout/PageHeader";

export function AdminNotificationsPageContent() {
  return (
    <NotificationsProvider>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Workspace"
          title="Notifications"
          description="An organized view of all workflow alerts. Open View Details for the full change summary."
          actions={<MarkAllNotificationsButton />}
        />
        <NotificationsList />
      </div>
    </NotificationsProvider>
  );
}
