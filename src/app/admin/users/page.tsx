import { AdminUsersManager } from "@/components/admin/AdminUsersManager";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireAdminPageAccess } from "@/lib/admin-page";
import { getManagedAdminStorageMode, listAdminAccounts } from "@/lib/admin-users";

export default async function AdminUsersPage() {
  const principal = await requireAdminPageAccess("/admin/users");
  const accounts = await listAdminAccounts();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin builder"
        title="Users"
        description="Invite Admins and Coordinators. Everyone signs in at /admin/sign-in. Coordinators only access the forms sheet and can resend notifications."
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