import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME, readAdminSessionToken } from "@/lib/admin-auth";
import { requireAdminApiAccess } from "@/lib/admin-api";
import {
  FORM_APPROVER_SESSION_COOKIE_NAME,
  readFormApproverSessionFromRequest,
  readFormApproverSessionToken,
} from "@/lib/forms/approver-auth";
import { config as formsConfig } from "@/lib/forms/config";

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

async function readAdminSessionFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const result = await readAdminSessionToken(token);
  if (!result.ok || !result.payload) return null;
  return result.payload;
}

async function readApproverSessionFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(FORM_APPROVER_SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const result = await readFormApproverSessionToken(token);
  if (!result.ok || !result.payload) return null;
  return result.payload;
}

export async function getFormsSessionUserFromRequest(request?: Request): Promise<FormsSessionUser | null> {
  let adminPayload = await readAdminSessionFromCookies();
  let approverPayload = await readApproverSessionFromCookies();

  if (request && !approverPayload) {
    const approverResult = await readFormApproverSessionFromRequest(request);
    if (approverResult.ok && approverResult.payload) {
      approverPayload = approverResult.payload;
    }
  }

  if (adminPayload) {
    return {
      email: adminPayload.username,
      name: adminPayload.username,
      roles: ["admin", "approver", "viewer"],
      isAdmin: true,
      isApprover: true,
    };
  }

  if (approverPayload) {
    return {
      email: approverPayload.email,
      name: approverPayload.email,
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
