import { NextResponse } from "next/server";

/** Prefer the shared Okta-aware logout so local and WSU sessions both end. */
export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/api/auth/okta/logout?next=/admin/sign-in", request.url));
}