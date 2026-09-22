import { NotificationsList } from "@/components/notifications/NotificationsList";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireAdminPageAccess } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  await requireAdminPageAccess("/admin/notifications", { allowCoordinator: true });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Notifications"
        description="In-app alerts from sheet workflows. Use the bell in the header for a quick dropdown; this page lists everything."
      />
      <NotificationsList />
    </div>
  );
}
