import { NextResponse } from "next/server";
import { resolvePrincipal } from "@/lib/identity";
import { isFormsDatabaseEnabled } from "@/lib/forms/db";
import { markNotificationRead } from "@/lib/workflows/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const principal = await resolvePrincipal(request);
  if (!principal) {
    return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  }
  if (!isFormsDatabaseEnabled()) {
    return Response.json({ error: "Notifications need Postgres (DATABASE_URL)." }, { status: 503 });
  }
  const email = principal.email?.includes("@")
    ? principal.email
    : principal.identifier.includes("@")
      ? principal.identifier
      : null;
  if (!email) return Response.json({ error: "No email on this account." }, { status: 400 });
  const { id } = await params;
  const ok = await markNotificationRead(id, email);
  if (!ok) return Response.json({ error: "Notification not found." }, { status: 404 });
  return Response.json({ ok: true });
}
