import { redirect } from "next/navigation";
import { getCurrentAdminAuthResult, canManageUsers } from "@/lib/admin-users";
import { normalizeAdminNextPath } from "@/lib/admin-auth";

export async function requireAdminPageAccess(
  nextPath: string,
  options?: { ownerOnly?: boolean; usersOnly?: boolean },
) {
  const normalizedNextPath = normalizeAdminNextPath(nextPath);
  const result = await getCurrentAdminAuthResult();

  if (!result.ok || !result.principal) {
    redirect(`/admin/sign-in?next=${encodeURIComponent(normalizedNextPath)}`);
  }

  if (result.principal.role === "coordinator") {
    redirect("/forms/sheet");
  }

  if (options?.ownerOnly && result.principal.role !== "owner") {
    redirect("/admin");
  }

  if (options?.usersOnly && !canManageUsers(result.principal.role)) {
    redirect("/admin");
  }

  return result.principal;
}