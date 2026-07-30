import { redirect } from "next/navigation";
import { getCurrentAdminAuthResult } from "@/lib/admin-users";
import { normalizeAdminNextPath } from "@/lib/admin-auth";

export async function requireAdminPageAccess(nextPath: string, options?: { ownerOnly?: boolean }) {
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

  return result.principal;
}