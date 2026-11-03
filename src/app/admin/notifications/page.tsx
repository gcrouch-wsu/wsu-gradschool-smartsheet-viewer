import { AdminNotificationsPageContent } from "@/components/notifications/NotificationsPage";
import { requireAdminPageAccess } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  await requireAdminPageAccess("/admin/notifications", { allowCoordinator: true });
  return <AdminNotificationsPageContent />;
}
