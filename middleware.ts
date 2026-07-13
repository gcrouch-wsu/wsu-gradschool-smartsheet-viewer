import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE_NAME,
  authorizeAdminSession,
  normalizeAdminNextPath,
} from "@/lib/admin-auth";
import { handleFormsMiddleware } from "@/lib/forms/forms-middleware";

const PUBLIC_ADMIN_PATHS = new Set([
  "/admin/sign-in",
  "/api/admin/session",
  "/api/admin/logout",
  "/api/admin/verify-session",
]);

async function adminPrincipalOk(request: NextRequest): Promise<{ ok: boolean; status: number; message: string }> {
  const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    const result = await authorizeAdminSession(null);
    return {
      ok: result.ok,
      status: result.status ?? 401,
      message: result.message ?? "Authentication required.",
    };
  }

  const verifyUrl = new URL("/api/admin/verify-session", request.nextUrl.origin);
  try {
    const res = await fetch(verifyUrl, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      return { ok: true, status: 200, message: "" };
    }
    let message = "Authentication required.";
    try {
      const body = (await res.json()) as { message?: string };
      if (typeof body.message === "string" && body.message.trim()) {
        message = body.message.trim();
      }
    } catch {
      /* ignore */
    }
    return { ok: false, status: res.status === 401 || res.status === 403 ? res.status : 401, message };
  } catch {
    return { ok: false, status: 503, message: "Unable to verify admin session." };
  }
}

export async function middleware(request: NextRequest) {
  const formsResult = await handleFormsMiddleware(request);
  if (formsResult) {
    return formsResult;
  }

  const { pathname, search } = request.nextUrl;
  const isAdminApiRequest = pathname === "/api/admin" || pathname.startsWith("/api/admin/");
  const isPublicAdminPath = PUBLIC_ADMIN_PATHS.has(pathname);

  // Sign-in page performs full principal resolution on the server.
  if (pathname === "/admin/sign-in") {
    return NextResponse.next();
  }

  if (isPublicAdminPath) {
    return NextResponse.next();
  }

  const auth = await adminPrincipalOk(request);
  if (auth.ok) {
    return NextResponse.next();
  }

  if (isAdminApiRequest) {
    return NextResponse.json(
      {
        message: auth.message,
      },
      {
        status: auth.status,
      },
    );
  }

  const signInUrl = new URL("/admin/sign-in", request.url);
  signInUrl.searchParams.set("next", normalizeAdminNextPath(`${pathname}${search}`));
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: [
    "/forms",
    "/forms/:path*",
    "/api/forms",
    "/api/forms/:path*",
    "/admin",
    "/admin/",
    "/admin/:path*",
    "/api/admin",
    "/api/admin/:path*",
  ],
};