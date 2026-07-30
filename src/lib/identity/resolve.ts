/**
 * Resolve Principal from cookies / request. Wraps existing auth libs without changing cookie format.
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
  type Principal,
  type PrincipalCapability,
  principalHasAnyCapability,
} from "@/lib/identity/principal";

export function adminPrincipalToPrincipal(
  admin: AdminPrincipal,
  session?: { issuedAt: number; expiresAt: number; version?: string },
): Principal {
  const capabilities: PrincipalCapability[] =
    admin.role === "coordinator"
      ? ["forms.coordinator", "forms.approver", "viewer"]
      : ["admin.manage", "forms.admin", "forms.approver", "contributor.edit", "viewer"];
  if (admin.role === "owner") {
    capabilities.push("admin.owner");
  }
  return {
    kind: "admin",
    id: admin.id,
    identifier: admin.username,
    displayName: admin.displayName ?? admin.username,
    email: admin.username.includes("@") ? admin.username : undefined,
    role: admin.role,
    source: admin.source,
    capabilities,
    session: {
      issuedAt: session?.issuedAt ?? Date.now(),
      expiresAt: session?.expiresAt ?? Date.now() + 12 * 60 * 60 * 1000,
      version: session?.version ?? admin.version,
    },
  };
}

export async function resolveAdminPrincipal(): Promise<Principal | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const auth = await resolveAdminPrincipalFromSession(token);
  if (!auth.ok || !auth.principal) return null;
  const sessionRead = await readAdminSessionToken(token);
  return adminPrincipalToPrincipal(
    auth.principal,
    sessionRead.ok && sessionRead.payload
      ? {
          issuedAt: sessionRead.payload.issuedAt,
          expiresAt: sessionRead.payload.expiresAt,
          version: sessionRead.payload.version,
        }
      : undefined,
  );
}

export async function resolveApproverPrincipal(request?: Request): Promise<Principal | null> {
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
    capabilities: ["forms.approver", "viewer"],
    session: {
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
      credentialsVersion: payload.credentialsVersion,
    },
  };
}

export async function resolveContributorPrincipal(): Promise<Principal | null> {
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
    capabilities: ["contributor.edit"],
    session: {
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
      credentialsVersion: payload.credentialsVersion,
    },
  };
}

/**
 * Highest-privilege principal among cookies present.
 * Prefer admin over approver over contributor.
 */
export async function resolvePrincipal(request?: Request): Promise<Principal | null> {
  const admin = await resolveAdminPrincipal();
  if (admin) return admin;
  const approver = await resolveApproverPrincipal(request);
  if (approver) return approver;
  return resolveContributorPrincipal();
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
