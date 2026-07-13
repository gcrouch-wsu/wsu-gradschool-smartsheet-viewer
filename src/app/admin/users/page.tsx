import { AdminUsersManager } from "@/components/admin/AdminUsersManager";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireAdminPageAccess } from "@/lib/admin-page";
import { getManagedAdminStorageMode, listAdminAccounts } from "@/lib/admin-users";

export default async function AdminUsersPage() {
  const principal = await requireAdminPageAccess("/admin/users", { ownerOnly: true });
  const accounts = await listAdminAccounts();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Admin builder"
        title="Admins"
        description="Accounts that can manage sources, views, forms, and other admins."
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