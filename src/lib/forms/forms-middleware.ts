import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME, authorizeAdminSession } from "@/lib/admin-auth";
import { FORM_APPROVER_SESSION_COOKIE_NAME } from "@/lib/forms/session-cookies";

/** Edge-safe student cookie name (do not import student-users — it pulls Node crypto). */
const STUDENT_SESSION_COOKIE_NAME = "smartsheets_view_student_session";

const FORMS_PUBLIC_PATHS = new Set([
  "/forms/approver/sign-in",
  "/api/forms/approver/session",
  "/api/forms/session",
]);

/** Student claim/login endpoints — no session required. */
const STUDENT_AUTH_PUBLIC_PATHS = new Set([
  "/api/forms/student/access-status",
  "/api/forms/student/claim",
  "/api/forms/student/login",
  "/api/forms/student/sign-out",
]);

function isPublicFormPath(pathname: string) {
  if (pathname === "/f" || pathname.startsWith("/f/")) return true;
  if (pathname.startsWith("/api/forms/public/")) return true;
  return false;
}

function isStudentPortalPath(pathname: string) {
  return (
    pathname === "/forms/my" ||
    pathname.startsWith("/forms/my/") ||
    pathname === "/api/forms/student" ||
    pathname.startsWith("/api/forms/student/")
  );
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

function isWorkflowsPath(pathname: string) {
  return (
    pathname === "/forms/workflows" ||
    pathname.startsWith("/forms/workflows/") ||
    pathname === "/api/forms/workflows" ||
    pathname.startsWith("/api/forms/workflows/")
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

function hasStudentSession(request: NextRequest): boolean {
  // Cookie presence for Edge; student Node handlers validate the token fully.
  // Unified platform sessions reuse the admin cookie name.
  return Boolean(
    request.cookies.get(STUDENT_SESSION_COOKIE_NAME)?.value?.trim() ||
      request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value?.trim(),
  );
}

async function resolveSessionAccess(request: NextRequest): Promise<{
  role: string | null;
  capabilities: string[];
  isStaff: boolean;
}> {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!token) return { role: null, capabilities: [], isStaff: false };
  const verifyUrl = new URL("/api/admin/verify-session", request.nextUrl.origin);
  try {
    const res = await fetch(verifyUrl, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { role: null, capabilities: [], isStaff: false };
    const body = (await res.json().catch(() => null)) as {
      role?: string;
      capabilities?: string[];
    } | null;
    const capabilities = Array.isArray(body?.capabilities) ? body.capabilities : [];
    const role = typeof body?.role === "string" ? body.role : null;
    const isStaff =
      capabilities.includes("admin.manage") ||
      capabilities.includes("forms.admin") ||
      capabilities.includes("forms.coordinator") ||
      capabilities.includes("forms.approver") ||
      role === "owner" ||
      role === "admin" ||
      role === "programs_team" ||
      role === "coordinator";
    return { role, capabilities, isStaff };
  } catch {
    return { role: null, capabilities: [], isStaff: false };
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

  if (FORMS_PUBLIC_PATHS.has(pathname) || STUDENT_AUTH_PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const signedIn = await hasAdminSession(request);
  const approverOk = hasApproverSession(request);
  const studentCookie = hasStudentSession(request);

  // Student portal: allow page without session (login UI); APIs need student/staff cookie.
  if (isStudentPortalPath(pathname)) {
    if (signedIn || approverOk || studentCookie) {
      return NextResponse.next();
    }
    if (!pathname.startsWith("/api/")) {
      return NextResponse.next();
    }
    return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  }

  const access = signedIn
    ? await resolveSessionAccess(request)
    : { role: null, capabilities: [] as string[], isStaff: false };
  const staffOk = access.isStaff || approverOk;

  // Sheet picker needs GET /api/forms/registry; coordinators share this with admins/approvers.
  if (isFormsRegistryListPath(pathname) && request.method === "GET") {
    if (staffOk) {
      return NextResponse.next();
    }
    return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  }

  // Coordinators can author workflows; approvers cannot.
  if (isWorkflowsPath(pathname)) {
    if (!signedIn) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ message: "Sign in required." }, { status: 401 });
      }
      const signInUrl = new URL("/admin/sign-in", request.url);
      signInUrl.searchParams.set("next", normalizeFormsNextPath(pathname, search));
      return NextResponse.redirect(signInUrl);
    }
    const role = access.role;
    const canAuthor =
      access.capabilities.includes("admin.manage") ||
      access.capabilities.includes("forms.coordinator") ||
      role === "owner" ||
      role === "admin" ||
      role === "programs_team" ||
      role === "coordinator";
    if (canAuthor) {
      return NextResponse.next();
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ message: "You do not have permission to create workflows." }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/forms/sheet", request.url));
  }

  if (isFormsAdminPath(pathname)) {
    if (signedIn) {
      const canManageForms =
        access.capabilities.includes("admin.manage") ||
        access.capabilities.includes("forms.admin") ||
        access.role === "owner" ||
        access.role === "admin" ||
        access.role === "programs_team";
      if (canManageForms) {
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

  // Staff forms routes: admin/approver only — contributor/student must not grant access.
  if (staffOk) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  }

  const signInUrl = new URL("/admin/sign-in", request.url);
  signInUrl.searchParams.set("next", normalizeFormsNextPath(pathname, search));
  return NextResponse.redirect(signInUrl);
}
