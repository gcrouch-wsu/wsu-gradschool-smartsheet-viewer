import { NextResponse } from "next/server";
import {
  CONTRIBUTOR_SESSION_COOKIE_NAME,
  getContributorSessionCookieSettings,
} from "@/lib/contributor-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(CONTRIBUTOR_SESSION_COOKIE_NAME, "", {
    ...getContributorSessionCookieSettings(),
    maxAge: 0,
  });
  return response;
}
