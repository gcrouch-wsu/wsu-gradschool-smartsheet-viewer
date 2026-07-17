import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME } from "@/lib/admin-auth";
import { FORM_APPROVER_SESSION_COOKIE_NAME } from "@/lib/forms/approver-auth";
import { hasAdminSessionToken, hasApproverSessionToken } from "@/lib/identity";
import { validateWebhookSecret } from "@/lib/forms/webhook-auth";

const FORMS_PUBLIC_PATHS = new Set([
  "/forms/approver/sign-in",
  "/api/forms/approver/session",
]);

function isPublicFormPath(pathname: string) {
  if (pathname === "/f" || pathname.startsWith("/f/")) return true;
  if (pathname.startsWith("/api/forms/public/")) return true;
  return false;
}

function isFormsPath(pathname: string) {
  return (
    isPublicFormPath(pathname) ||
    pathname === "/forms" ||
    pathname.startsWith("/forms/") ||
    pathname === "/api/forms" ||
    pathname.startsWith("/api/forms/")
  );
}

function isFormsAdminPath(pathname: string) {
  return (
    pathname === "/forms/manage" ||
    pathname.startsWith("/forms/manage/") ||
    pathname === "/forms/builder" ||
    pathname.startsWith("/forms/builder/") ||
    pathname.startsWith("/api/forms/builder") ||
    pathname.startsWith("/api/forms/registry") ||
    pathname.startsWith("/api/forms/platform") ||
    (pathname.startsWith("/api/forms/webhooks") && !pathname.startsWith("/api/forms/webhooks/smartsheet"))
  );
}

function normalizeFormsNextPath(pathname: string, search: string) {
  const next = `${pathname}${search}`;
  if (!next.startsWith("/forms")) return "/forms";
  return next;
}

async function hasAdminSession(request: NextRequest): Promise<boolean> {
  return hasAdminSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value);
}

async function hasApproverSession(request: NextRequest): Promise<boolean> {
  return hasApproverSessionToken(request.cookies.get(FORM_APPROVER_SESSION_COOKIE_NAME)?.value);
}

export async function handleFormsMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const { pathname, search } = request.nextUrl;
  if (!isFormsPath(pathname)) return null;

  if (isPublicFormPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname === "/api/forms/webhooks/smartsheet" && request.method === "POST") {
    if (validateWebhookSecret(request)) return NextResponse.next();
    return NextResponse.json({ message: "Invalid webhook secret." }, { status: 401 });
  }

  if (FORMS_PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const adminOk = await hasAdminSession(request);
  const approverOk = await hasApproverSession(request);

  if (isFormsAdminPath(pathname)) {
    if (adminOk) return NextResponse.next();
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ message: "Admin authentication required." }, { status: 401 });
    }
    const signInUrl = new URL("/admin/sign-in", request.url);
    signInUrl.searchParams.set("next", normalizeFormsNextPath(pathname, search));
    return NextResponse.redirect(signInUrl);
  }

  if (adminOk || approverOk) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  }

  const signInUrl = new URL("/forms/approver/sign-in", request.url);
  signInUrl.searchParams.set("next", normalizeFormsNextPath(pathname, search));
  return NextResponse.redirect(signInUrl);
}
