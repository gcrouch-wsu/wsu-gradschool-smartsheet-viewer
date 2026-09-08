import { NextResponse } from "next/server";
import { resolvePrincipal } from "@/lib/identity";
import { isFormsDatabaseEnabled } from "@/lib/forms/db";
import { listNotificationsForEmail } from "@/lib/workflows/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function principalEmail(email: string | undefined, identifier: string): string | null {
  if (email?.includes("@")) return email;
  if (identifier.includes("@")) return identifier;
  return null;
}

export async function GET(request: Request) {
  const principal = await resolvePrincipal(request);
  if (!principal) {
    return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  }
  if (!isFormsDatabaseEnabled()) {
    return Response.json({ items: [], unreadCount: 0, available: false });
  }
  const email = principalEmail(principal.email, principal.identifier);
  if (!email) {
    return Response.json({ items: [], unreadCount: 0, available: true, notice: "This account has no email address for notifications." });
  }
  const result = await listNotificationsForEmail(email);
  return Response.json({ ...result, available: true });
}
