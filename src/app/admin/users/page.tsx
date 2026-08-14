import { AdminUsersManager } from "@/components/admin/AdminUsersManager";
import {
  USERS_TOUR_STEPS,
  USERS_TOUR_STORAGE_KEY,
} from "@/components/admin/tours/users-tour";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProductTourControls } from "@/components/ui/ProductTourHost";
import { requireAdminPageAccess } from "@/lib/admin-page";
import { getManagedAdminStorageMode, listAdminAccounts } from "@/lib/admin-users";

export default async function AdminUsersPage() {
  const principal = await requireAdminPageAccess("/admin/users", { usersOnly: true });
  const accounts = await listAdminAccounts();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin builder"
        title="Users"
        description="Invite Admins, Programs Team, and Coordinators. Everyone signs in at /admin/sign-in. Programs Team has full admin access except adding users. Coordinators only access the forms sheet and can resend notifications."
        dataTour="au-heading"
        actions={
          <ProductTourControls storageKey={USERS_TOUR_STORAGE_KEY} steps={USERS_TOUR_STEPS} />
        }
      />
      <AdminUsersManager
        bootstrapUser={accounts.bootstrap}
        initialUsers={accounts.users}
        ownerLabel={principal.displayName ?? principal.username}
        storageMode={getManagedAdminStorageMode()}
      />
    </div>
  );
}