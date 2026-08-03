import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME, authorizeAdminSession } from "@/lib/admin-auth";
import { FORM_APPROVER_SESSION_COOKIE_NAME } from "@/lib/forms/session-cookies";

const FORMS_PUBLIC_PATHS = new Set([
  "/forms/approver/sign-in",
  "/api/forms/approver/session",
  "/api/forms/session",
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
    pathname.startsWith("/api/forms/registry/") ||
    pathname.startsWith("/api/forms/platform") ||
    (pathname.startsWith("/api/forms/webhooks") && !pathname.startsWith("/api/forms/webhooks/smartsheet"))
  );
}

/** Read-only registry list used by the sheet picker — sheet staff (admin + coordinator) may access. */
function isFormsRegistryListPath(pathname: string) {
  return pathname === "/api/forms/registry";
}

function normalizeFormsNextPath(pathname: string, search: string) {
  const next = `${pathname}${search}`;
  if (!next.startsWith("/forms")) return "/forms/sheet";
  if (next === "/forms" || next === "/forms/") return "/forms/sheet";
  return next;
}

async function hasAdminSession(request: NextRequest): Promise<boolean> {
  // Edge-safe signature check only (full principal resolution stays in Node route handlers).
  const result = await authorizeAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value ?? null);
  return result.ok;
}

function hasApproverSession(request: NextRequest): boolean {
  // Cookie presence for Edge; Node handlers still validate the token fully.
  return Boolean(request.cookies.get(FORM_APPROVER_SESSION_COOKIE_NAME)?.value?.trim());
}

async function resolveAdminRole(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const verifyUrl = new URL("/api/admin/verify-session", request.nextUrl.origin);
  try {
    const res = await fetch(verifyUrl, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as { role?: string } | null;
    return typeof body?.role === "string" ? body.role : null;
  } catch {
    return null;
  }
}

export async function handleFormsMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const { pathname, search } = request.nextUrl;
  if (!isFormsPath(pathname)) return null;

  if (isPublicFormPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname === "/api/forms/webhooks/smartsheet" && request.method === "POST") {
    // Auth is enforced in the route (env or persisted secret).
    return NextResponse.next();
  }

  if (pathname === "/forms/approver/sign-in") {
    const dest = new URL("/admin/sign-in", request.url);
    dest.searchParams.set("next", "/forms/sheet");
    return NextResponse.redirect(dest);
  }

  if (FORMS_PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const adminOk = await hasAdminSession(request);
  const approverOk = hasApproverSession(request);

  // Sheet picker needs GET /api/forms/registry; coordinators share this with admins/approvers.
  if (isFormsRegistryListPath(pathname) && request.method === "GET") {
    if (adminOk || approverOk) {
      return NextResponse.next();
    }
    return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  }

  if (isFormsAdminPath(pathname)) {
    if (adminOk) {
      const role = await resolveAdminRole(request);
      if (role === "owner" || role === "admin" || role === "programs_team") {
        return NextResponse.next();
      }
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ message: "Full admin access is required." }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/forms/sheet", request.url));
    }
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

  const signInUrl = new URL("/admin/sign-in", request.url);
  signInUrl.searchParams.set("next", normalizeFormsNextPath(pathname, search));
  return NextResponse.redirect(signInUrl);
}
