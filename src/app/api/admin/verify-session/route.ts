import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME } from "@/lib/admin-auth";
import { resolveAdminPrincipalFromSession } from "@/lib/admin-users";
import { capabilitiesForUserRoles, getPlatformUserById } from "@/lib/platform-users";
import { isPlatformSessionPayload, readUnifiedSessionToken } from "@/lib/platform-session";
import { capabilitiesForRoles } from "@/lib/identity/roles";
import type { PrincipalCapability } from "@/lib/identity/principal";

export const runtime = "nodejs";

/**
 * Session check for Edge middleware: returns capabilities so redirects use
 * admin.manage instead of hardcoded coordinator role names.
 */
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;

  const unified = await readUnifiedSessionToken(token);
  if (unified.ok && isPlatformSessionPayload(unified.payload)) {
    const user = await getPlatformUserById(unified.payload.userId);
    if (!user || !user.isActive || user.updatedAt !== unified.payload.credentialsVersion) {
      return NextResponse.json({ ok: false, message: "Authentication required." }, { status: 401 });
    }
    const capabilities = await capabilitiesForUserRoles(user.roles);
    return NextResponse.json({
      ok: true,
      capabilities,
      roles: user.roles,
      canAccessAdmin: capabilities.includes("admin.manage"),
      role: user.roles.includes("owner")
        ? "owner"
        : user.roles.includes("admin")
          ? "admin"
          : user.roles.includes("programs_team")
            ? "programs_team"
            : user.roles.includes("coordinator")
              ? "coordinator"
              : user.roles[0] ?? "viewer",
    });
  }

  const result = await resolveAdminPrincipalFromSession(token);
  if (!result.ok || !result.principal) {
    return NextResponse.json(
      { ok: false, message: result.message ?? "Authentication required." },
      { status: result.status ?? 401 },
    );
  }

  const role = result.principal.role;
  const roles =
    role === "owner"
      ? (["owner", "admin"] as const)
      : role === "coordinator"
        ? (["coordinator"] as const)
        : role === "programs_team"
          ? (["programs_team"] as const)
          : (["admin"] as const);
  const capabilities: PrincipalCapability[] = capabilitiesForRoles([...roles]);
  if (role === "owner" && !capabilities.includes("admin.owner")) {
    capabilities.push("admin.owner");
  }

  return NextResponse.json({
    ok: true,
    role,
    capabilities,
    roles,
    canAccessAdmin: capabilities.includes("admin.manage"),
  });
}
