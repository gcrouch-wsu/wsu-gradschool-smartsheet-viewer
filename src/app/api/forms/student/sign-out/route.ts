import { NextResponse } from "next/server";
import { clearAllAppSessionCookies } from "@/lib/okta/clear-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearAllAppSessionCookies(response);
  return response;
}
