import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/admin-api";
import { config as formsConfig } from "@/lib/forms/config";
import { isFullAdminRole } from "@/lib/admin-users";
import { resolveAdminPrincipal, resolveApproverPrincipal } from "@/lib/identity";

export type FormsRole = "admin" | "approver" | "viewer" | "coordinator" | "programs_team";

export interface FormsSessionUser {
  email: string;
  name: string;
  roles: FormsRole[];
  isAdmin: boolean;
  isApprover: boolean;
  isCoordinator: boolean;
  isProgramsTeam: boolean;
}

export interface FormsAccessResult {
  user: FormsSessionUser;
  isAdmin: boolean;
  isApprover: boolean;
  isCoordinator: boolean;
  isProgramsTeam: boolean;
}

export interface FormsAccessError {
  response: NextResponse;
}

export async function getFormsSessionUserFromRequest(request?: Request): Promise<FormsSessionUser | null> {
  const admin = await resolveAdminPrincipal();
  if (admin) {
    if (admin.role === "coordinator") {
      return {
        email: admin.email ?? admin.identifier,
        name: admin.displayName,
        roles: ["coordinator", "approver", "viewer"],
        isAdmin: false,
        isApprover: true,
        isCoordinator: true,
        isProgramsTeam: false,
      };
    }
    if (admin.role === "programs_team") {
      return {
        email: admin.email ?? admin.identifier,
        name: admin.displayName,
        roles: ["programs_team", "admin", "approver", "viewer"],
        isAdmin: true,
        isApprover: true,
        isCoordinator: false,
        isProgramsTeam: true,
      };
    }
    return {
      email: admin.email ?? admin.identifier,
      name: admin.displayName,
      roles: ["admin", "approver", "viewer"],
      isAdmin: true,
      isApprover: true,
      isCoordinator: false,
      isProgramsTeam: false,
    };
  }

  const approver = await resolveApproverPrincipal(request);
  if (approver) {
    return {
      email: approver.email ?? approver.identifier,
      name: approver.displayName,
      roles: ["approver", "viewer"],
      isAdmin: false,
      isApprover: true,
      isCoordinator: false,
      isProgramsTeam: false,
    };
  }

  return null;
}

export async function getFormsSessionPayload() {
  const user = await getFormsSessionUserFromRequest();
  return {
    demo: formsConfig.demo,
    user,
    roles: user?.roles ?? [],
    isAdmin: user?.isAdmin ?? false,
    isApprover: user?.isApprover ?? false,
    isCoordinator: user?.isCoordinator ?? false,
    isProgramsTeam: user?.isProgramsTeam ?? false,
  };
}

function unauthorizedResponse(message = "Sign in required.", status = 401) {
  return NextResponse.json({ message }, { status });
}

function forbiddenResponse(message = "You do not have permission for this action.") {
  return NextResponse.json({ message }, { status: 403 });
}

export async function requireFormsAccess(request?: Request): Promise<FormsAccessResult | FormsAccessError> {
  const user = await getFormsSessionUserFromRequest(request);
  if (!user) {
    return { response: unauthorizedResponse() };
  }
  return {
    user,
    isAdmin: user.isAdmin,
    isApprover: user.isApprover,
    isCoordinator: user.isCoordinator,
    isProgramsTeam: user.isProgramsTeam,
  };
}

export async function requireFormsAdminAccess(): Promise<FormsAccessResult | FormsAccessError> {
  const auth = await requireAdminApiAccess();
  if (auth.response) {
    return { response: auth.response };
  }
  const principal = auth.principal!;
  if (!isFullAdminRole(principal.role)) {
    return { response: forbiddenResponse("Full admin access is required.") };
  }
  const isProgramsTeam = principal.role === "programs_team";
  return {
    user: {
      email: principal.username,
      name: principal.displayName ?? principal.username,
      roles: isProgramsTeam
        ? ["programs_team", "admin", "approver", "viewer"]
        : ["admin", "approver", "viewer"],
      isAdmin: true,
      isApprover: true,
      isCoordinator: false,
      isProgramsTeam,
    },
    isAdmin: true,
    isApprover: true,
    isCoordinator: false,
    isProgramsTeam,
  };
}

export async function requireFormsApproverAccess(request?: Request): Promise<FormsAccessResult | FormsAccessError> {
  const access = await requireFormsAccess(request);
  if ("response" in access) return access;
  if (!access.isApprover && !access.isAdmin) {
    return { response: forbiddenResponse() };
  }
  return access;
}

export function formsAuthErrorResponse(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? Number((error as { status: number }).status) : 500;
  const message =
    typeof error === "object" && error && "message" in error && typeof (error as { message: string }).message === "string"
      ? (error as { message: string }).message
      : "Request failed.";
  return NextResponse.json({ error: message }, { status: status >= 400 && status < 600 ? status : 500 });
}
