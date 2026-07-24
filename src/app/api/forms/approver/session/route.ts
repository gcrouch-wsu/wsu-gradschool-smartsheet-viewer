import { NextResponse } from "next/server";
import {
  FORM_APPROVER_SESSION_COOKIE_NAME,
  authenticateFormApprover,
  getFormApproverConfigurationError,
  getFormApproverSessionCookieSettings,
  getTrustedIpFromRequest,
} from "@/lib/forms/approver-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const configurationError = getFormApproverConfigurationError();
  if (configurationError) {
    return NextResponse.json({ message: configurationError }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ message: "Email and password are required." }, { status: 400 });
  }

  const result = await authenticateFormApprover(email, password, getTrustedIpFromRequest(request));
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  const response = NextResponse.json({ ok: true, email: result.email });
  response.cookies.set({
    ...getFormApproverSessionCookieSettings(),
    name: FORM_APPROVER_SESSION_COOKIE_NAME,
    value: result.token,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    ...getFormApproverSessionCookieSettings(),
    name: FORM_APPROVER_SESSION_COOKIE_NAME,
    value: "",
    maxAge: 0,
  });
  return response;
}
