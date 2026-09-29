import { UsersWorkspace } from "@/components/admin/UsersWorkspace";
import {
  USERS_TOUR_STEPS,
  USERS_TOUR_STORAGE_KEY,
} from "@/components/admin/tours/users-tour";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProductTourControls } from "@/components/ui/ProductTourHost";
import { requireAdminPageAccess } from "@/lib/admin-page";
import { canManageUsers, getBootstrapAdminSummary } from "@/lib/admin-users";
import { isDatabaseConfigEnabled } from "@/lib/config/config-db";
import { getRolePermissionMatrix, listPlatformUsers } from "@/lib/platform-users";

export default async function AdminUsersPage() {
  const principal = await requireAdminPageAccess("/admin/users", { usersOnly: true });
  const bootstrap = getBootstrapAdminSummary();
  const databaseEnabled = isDatabaseConfigEnabled();
  const showRolesTab = canManageUsers(principal.role);

  const [users, rolesMatrix] = await Promise.all([
    databaseEnabled ? listPlatformUsers() : Promise.resolve([]),
    databaseEnabled && showRolesTab ? getRolePermissionMatrix() : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin builder"
        title="Users"
        description="One directory for every account. Assign roles on Accounts; admins can edit the permission matrix on Roles."
        dataTour="au-heading"
        actions={
          <ProductTourControls storageKey={USERS_TOUR_STORAGE_KEY} steps={USERS_TOUR_STEPS} />
        }
      />
      <UsersWorkspace
        bootstrapEmail={bootstrap?.username ?? null}
        bootstrapLabel={bootstrap?.displayName ?? "Bootstrap Owner"}
        initialUsers={users}
        showRolesTab={showRolesTab}
        rolesMatrix={rolesMatrix}
        databaseEnabled={databaseEnabled}
      />
    </div>
  );
}
