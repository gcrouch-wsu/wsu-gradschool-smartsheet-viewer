import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/admin-api";
import { config as formsConfig } from "@/lib/forms/config";
import { resolveAdminPrincipal, resolveApproverPrincipal } from "@/lib/identity";

export type FormsRole = "admin" | "approver" | "viewer";

export interface FormsSessionUser {
  email: string;
  name: string;
  roles: FormsRole[];
  isAdmin: boolean;
  isApprover: boolean;
}

export interface FormsAccessResult {
  user: FormsSessionUser;
  isAdmin: boolean;
  isApprover: boolean;
}

export interface FormsAccessError {
  response: NextResponse;
}

export async function getFormsSessionUserFromRequest(request?: Request): Promise<FormsSessionUser | null> {
  const admin = await resolveAdminPrincipal();
  if (admin) {
    return {
      email: admin.identifier,
      name: admin.displayName,
      roles: ["admin", "approver", "viewer"],
      isAdmin: true,
      isApprover: true,
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
  return { user, isAdmin: user.isAdmin, isApprover: user.isApprover };
}

export async function requireFormsAdminAccess(): Promise<FormsAccessResult | FormsAccessError> {
  const auth = await requireAdminApiAccess();
  if (auth.response) {
    return { response: auth.response };
  }
  const principal = auth.principal!;
  return {
    user: {
      email: principal.username,
      name: principal.displayName ?? principal.username,
      roles: ["admin", "approver", "viewer"],
      isAdmin: true,
      isApprover: true,
    },
    isAdmin: true,
    isApprover: true,
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
