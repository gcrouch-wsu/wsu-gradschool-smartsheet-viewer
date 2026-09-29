/**
 * Resolve Principal from the unified platform session cookie (and legacy cookies during transition).
 */
import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE_NAME,
  authorizeAdminSession,
  readAdminSessionToken,
} from "@/lib/admin-auth";
import { resolveAdminPrincipalFromSession, type AdminPrincipal } from "@/lib/admin-users";
import {
  CONTRIBUTOR_SESSION_COOKIE_NAME,
  readContributorSessionToken,
} from "@/lib/contributor-auth";
import {
  FORM_APPROVER_SESSION_COOKIE_NAME,
  readFormApproverSessionFromRequest,
  readFormApproverSessionToken,
} from "@/lib/forms/approver-auth";
import {
  STUDENT_SESSION_COOKIE_NAME,
  readStudentSessionToken,
} from "@/lib/forms/student-users";
import {
  type Principal,
  type PrincipalCapability,
  kindFromCapabilities,
  principalHasAnyCapability,
} from "@/lib/identity/principal";
import {
  isPlatformSessionPayload,
  readUnifiedSessionToken,
} from "@/lib/platform-session";
import {
  capabilitiesForUserRoles,
  getPlatformUserById,
  primaryStaffRole,
} from "@/lib/platform-users";
import type { PlatformRole } from "@/lib/identity/roles";
import { capabilitiesForRoles } from "@/lib/identity/roles";

export function adminPrincipalToPrincipal(
  admin: AdminPrincipal,
  session?: { issuedAt: number; expiresAt: number; version?: string },
  roles?: PlatformRole[],
  capabilities?: PrincipalCapability[],
): Principal {
  const resolvedRoles =
    roles ??
    (admin.role === "owner"
      ? (["owner", "admin"] as PlatformRole[])
      : admin.role === "coordinator"
        ? (["coordinator"] as PlatformRole[])
        : admin.role === "programs_team"
          ? (["programs_team"] as PlatformRole[])
          : (["admin"] as PlatformRole[]));

  const resolvedCapabilities: PrincipalCapability[] =
    capabilities ??
    (admin.role === "coordinator"
      ? ["forms.coordinator", "forms.approver", "viewer"]
      : capabilitiesForRoles(resolvedRoles));

  if (admin.role === "owner" && !resolvedCapabilities.includes("admin.owner")) {
    resolvedCapabilities.push("admin.owner");
  }

  return {
    kind: "admin",
    id: admin.id,
    identifier: admin.username,
    displayName: admin.displayName ?? admin.username,
    email: admin.username.includes("@") ? admin.username : undefined,
    role: admin.role,
    roles: resolvedRoles,
    source: admin.source,
    capabilities: resolvedCapabilities,
    session: {
      issuedAt: session?.issuedAt ?? Date.now(),
      expiresAt: session?.expiresAt ?? Date.now() + 12 * 60 * 60 * 1000,
      version: session?.version ?? admin.version,
    },
  };
}

async function principalFromPlatformUser(
  userId: string,
  session: { issuedAt: number; expiresAt: number; credentialsVersion: string },
): Promise<Principal | null> {
  const user = await getPlatformUserById(userId);
  if (!user || !user.isActive) return null;
  if (user.updatedAt !== session.credentialsVersion) return null;

  const capabilities = await capabilitiesForUserRoles(user.roles);
  const staffRole = primaryStaffRole(user.roles);
  const kind = kindFromCapabilities(capabilities);

  return {
    kind: kind === "platform" ? "admin" : kind,
    id: user.id,
    identifier: user.email,
    displayName: user.displayName ?? user.email,
    email: user.email,
    role: staffRole ?? undefined,
    roles: user.roles,
    source: "managed",
    capabilities,
    session: {
      issuedAt: session.issuedAt,
      expiresAt: session.expiresAt,
      credentialsVersion: session.credentialsVersion,
      version: user.updatedAt,
    },
  };
}

async function resolveFromUnifiedCookie(): Promise<Principal | null> {
  const cookieStore = await cookies();
  const unifiedToken = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!unifiedToken) return null;

  const unified = await readUnifiedSessionToken(unifiedToken);
  if (!unified.ok) return null;

  if (isPlatformSessionPayload(unified.payload)) {
    return principalFromPlatformUser(unified.payload.userId, {
      issuedAt: unified.payload.issuedAt,
      expiresAt: unified.payload.expiresAt,
      credentialsVersion: unified.payload.credentialsVersion,
    });
  }

  const auth = await resolveAdminPrincipalFromSession(unifiedToken);
  if (auth.ok && auth.principal) {
    return adminPrincipalToPrincipal(auth.principal, {
      issuedAt: unified.payload.issuedAt,
      expiresAt: unified.payload.expiresAt,
      version: unified.payload.version,
    });
  }
  return null;
}

/**
 * Highest-privilege principal among cookies present.
 * Prefer unified session, then legacy approver / contributor / student cookies.
 */
export async function resolvePrincipal(request?: Request): Promise<Principal | null> {
  const fromUnified = await resolveFromUnifiedCookie();
  if (fromUnified) return fromUnified;

  const approver = await resolveLegacyApproverPrincipal(request);
  if (approver) return approver;
  const contributor = await resolveLegacyContributorPrincipal();
  if (contributor) return contributor;
  return resolveLegacyStudentPrincipal();
}

export async function resolveAdminPrincipal(): Promise<Principal | null> {
  const principal = await resolveFromUnifiedCookie();
  if (!principal) return null;
  if (
    principal.capabilities.includes("admin.manage") ||
    principal.capabilities.includes("forms.coordinator") ||
    principal.capabilities.includes("forms.admin") ||
    principal.role
  ) {
    return principal;
  }
  return null;
}

async function resolveLegacyApproverPrincipal(request?: Request): Promise<Principal | null> {
  let payload: { email: string; issuedAt: number; expiresAt: number; credentialsVersion: string } | null =
    null;

  if (request) {
    const fromReq = await readFormApproverSessionFromRequest(request);
    if (fromReq.ok && fromReq.payload) {
      payload = fromReq.payload;
    }
  }

  if (!payload) {
    const cookieStore = await cookies();
    const token = cookieStore.get(FORM_APPROVER_SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    const result = await readFormApproverSessionToken(token);
    if (!result.ok || !result.payload) return null;
    payload = result.payload;
  }

  return {
    kind: "form_approver",
    id: payload.email,
    identifier: payload.email,
    displayName: payload.email,
    email: payload.email,
    roles: ["approver"],
    capabilities: ["forms.approver", "viewer"],
    session: {
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
      credentialsVersion: payload.credentialsVersion,
    },
  };
}

export async function resolveApproverPrincipal(request?: Request): Promise<Principal | null> {
  const fromUnified = await resolveFromUnifiedCookie();
  if (fromUnified?.capabilities.includes("forms.approver")) {
    return fromUnified;
  }
  return resolveLegacyApproverPrincipal(request);
}

async function resolveLegacyContributorPrincipal(): Promise<Principal | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(CONTRIBUTOR_SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const result = await readContributorSessionToken(token);
  if (!result.ok || !result.payload) return null;
  const payload = result.payload;
  return {
    kind: "contributor",
    id: payload.email,
    identifier: payload.email,
    displayName: payload.email,
    email: payload.email,
    roles: ["contributor"],
    capabilities: ["contributor.edit"],
    session: {
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
      credentialsVersion: payload.credentialsVersion,
    },
  };
}

export async function resolveContributorPrincipal(): Promise<Principal | null> {
  const fromUnified = await resolveFromUnifiedCookie();
  if (fromUnified?.capabilities.includes("contributor.edit")) {
    return fromUnified;
  }
  return resolveLegacyContributorPrincipal();
}

async function resolveLegacyStudentPrincipal(): Promise<Principal | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STUDENT_SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const result = await readStudentSessionToken(token);
  if (!result.ok || !result.payload) return null;
  const payload = result.payload;
  return {
    kind: "student",
    id: payload.email,
    identifier: payload.email,
    displayName: payload.email,
    email: payload.email,
    roles: ["student"],
    capabilities: ["forms.student", "viewer"],
    session: {
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
      credentialsVersion: payload.credentialsVersion,
    },
  };
}

export async function resolveStudentPrincipal(): Promise<Principal | null> {
  const fromUnified = await resolveFromUnifiedCookie();
  if (fromUnified?.capabilities.includes("forms.student")) {
    return fromUnified;
  }
  return resolveLegacyStudentPrincipal();
}

export async function requirePrincipalCapabilities(
  capabilities: PrincipalCapability[],
  request?: Request,
): Promise<{ principal: Principal } | { error: { status: number; message: string } }> {
  const principal = await resolvePrincipal(request);
  if (!principal) {
    return { error: { status: 401, message: "Sign in required." } };
  }
  if (!principalHasAnyCapability(principal, capabilities)) {
    return { error: { status: 403, message: "You do not have permission for this action." } };
  }
  return { principal };
}

/** Edge-safe admin session check (signature only — matches forms middleware today). */
export async function hasAdminSessionToken(token: string | undefined | null): Promise<boolean> {
  const result = await authorizeAdminSession(token ?? null);
  return result.ok;
}

/** Edge-safe approver session check. */
export async function hasApproverSessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const result = await readFormApproverSessionToken(token);
  return result.ok;
}

export { readAdminSessionToken };
