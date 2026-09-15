import { redirect } from "next/navigation";
import { NotificationsList } from "@/components/notifications/NotificationsList";
import { StudentPageFrame } from "@/components/forms/student/StudentPageFrame";
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
    <StudentPageFrame
      breadcrumbs={[{ href: null, label: "Notifications" }]}
      title="Notifications"
      description="In-app alerts from sheet workflows."
    >
      <NotificationsList />
    </StudentPageFrame>
  );
}
