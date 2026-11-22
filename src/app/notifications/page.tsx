import { redirect } from "next/navigation";
import {
  MarkAllNotificationsButton,
  NotificationsProvider,
} from "@/components/notifications/NotificationsContext";
import { NotificationsList } from "@/components/notifications/NotificationsList";
import { StudentPageFrame } from "@/components/forms/student/StudentPageFrame";
import { ProductTourControls } from "@/components/ui/ProductTourHost";
import {
  NOTIFICATIONS_TOUR_STEPS,
  NOTIFICATIONS_TOUR_STORAGE_KEY,
} from "@/components/notifications/notifications-tour";
import {
  resolveAdminPrincipal,
  resolveApproverPrincipal,
  resolveContributorPrincipal,
  resolveStudentPrincipal,
} from "@/lib/identity";

export const dynamic = "force-dynamic";

/**
 * Smart entry: staff land in the admin Notifications section (same chrome as Activity).
 * Students and contributors keep the student frame.
 */
export default async function NotificationsEntryPage() {
  const admin = await resolveAdminPrincipal();
  if (admin) {
    redirect("/admin/notifications");
  }

  const approver = await resolveApproverPrincipal();
  if (approver) {
    redirect("/admin/sign-in?next=/admin/notifications");
  }

  const contributor = await resolveContributorPrincipal();
  const student = await resolveStudentPrincipal();
  if (!contributor && !student) {
    redirect("/admin/sign-in?next=/notifications");
  }

  return (
    <NotificationsProvider>
      <StudentPageFrame
        breadcrumbs={[{ href: null, label: "Notifications" }]}
        title="Notifications"
        description="An organized view of all workflow alerts. Open View Details for the full change summary."
        headingTourId="an-heading"
        actions={
          <>
            <ProductTourControls storageKey={NOTIFICATIONS_TOUR_STORAGE_KEY} steps={NOTIFICATIONS_TOUR_STEPS} />
            <span data-tour="an-mark">
              <MarkAllNotificationsButton />
            </span>
          </>
        }
        signOutHref={
          contributor && !student
            ? "/api/auth/okta/logout?next=/"
            : "/api/auth/okta/logout?next=/student"
        }
      >
        <NotificationsList />
      </StudentPageFrame>
    </NotificationsProvider>
  );
}
