import { NextResponse } from "next/server";
import { OKTA_CALLBACK_PATH } from "@/lib/okta/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Legacy path — forward query string to the ITS-registered callback. */
export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const dest = new URL(OKTA_CALLBACK_PATH, request.url);
  dest.search = incoming.search;
  return NextResponse.redirect(dest);
}
