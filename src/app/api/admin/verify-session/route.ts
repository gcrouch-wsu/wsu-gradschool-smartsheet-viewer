import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME } from "@/lib/admin-auth";
import { resolveAdminPrincipalFromSession } from "@/lib/admin-users";

export const runtime = "nodejs";

/**
 * Lightweight session check for Edge middleware: resolves managed/bootstrap admin
 * against live storage (same rules as admin API routes).
 */
export async function GET() {
  const cookieStore = await cookies();
  const result = await resolveAdminPrincipalFromSession(cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value);
  if (!result.ok || !result.principal) {
    return NextResponse.json(
      { ok: false, message: result.message ?? "Authentication required." },
      { status: result.status ?? 401 },
    );
  }
  return NextResponse.json({ ok: true, role: result.principal.role });
}
