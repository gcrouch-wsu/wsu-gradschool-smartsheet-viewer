import { redirect } from "next/navigation";
import { getCurrentAdminAuthResult, canManageUsers } from "@/lib/admin-users";
import { normalizeAdminNextPath } from "@/lib/admin-auth";
import { principalHasCapability } from "@/lib/identity/principal";
import { adminPrincipalToPrincipal } from "@/lib/identity/resolve";
import { capabilitiesForUserRoles, getPlatformUserById } from "@/lib/platform-users";

export async function requireAdminPageAccess(
  nextPath: string,
  options?: { ownerOnly?: boolean; usersOnly?: boolean; allowCoordinator?: boolean },
) {
  const normalizedNextPath = normalizeAdminNextPath(nextPath);
  const result = await getCurrentAdminAuthResult();

  if (!result.ok || !result.principal) {
    redirect(`/admin/sign-in?next=${encodeURIComponent(normalizedNextPath)}`);
  }

  let capabilities = adminPrincipalToPrincipal(result.principal).capabilities;
  if (result.principal.source === "managed") {
    const platformUser = await getPlatformUserById(result.principal.id);
    if (platformUser) {
      capabilities = await capabilitiesForUserRoles(platformUser.roles);
    }
  }

  const canManage = capabilities.includes("admin.manage");
  if (!canManage && !options?.allowCoordinator) {
    redirect("/forms/sheet");
  }

  if (options?.ownerOnly && !capabilities.includes("admin.owner") && result.principal.role !== "owner") {
    redirect("/admin");
  }

  if (options?.usersOnly && !canManageUsers(result.principal.role)) {
    redirect("/admin");
  }

  // Coordinator with allowCoordinator but no admin.manage still ok for notifications
  if (!canManage && options?.allowCoordinator) {
    return result.principal;
  }

  if (!canManage) {
    redirect("/forms/sheet");
  }

  return result.principal;
}

export { principalHasCapability };
