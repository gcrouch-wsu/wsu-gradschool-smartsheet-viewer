import { AdminUsersManager } from "@/components/admin/AdminUsersManager";
import { requireAdminPageAccess } from "@/lib/admin-page";
import { getManagedAdminStorageMode, listAdminAccounts } from "@/lib/admin-users";

export default async function AdminUsersPage() {
  const principal = await requireAdminPageAccess("/admin/users", { ownerOnly: true });
  const accounts = await listAdminAccounts();

  return (
    <>
      <AdminUsersManager
        bootstrapUser={accounts.bootstrap}
        initialUsers={accounts.users}
        ownerLabel={principal.displayName ?? principal.username}
        storageMode={getManagedAdminStorageMode()}
      />
    </>
  );
}