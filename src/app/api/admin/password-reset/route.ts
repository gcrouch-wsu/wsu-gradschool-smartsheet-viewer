import { NextResponse } from "next/server";
import { validateAdminPassword } from "@/lib/admin-auth";
import {
  ADMIN_LOGIN_TOO_MANY_ATTEMPTS_ERROR,
  isAdminLoginRateLimited,
  recordAdminFailedLoginAttempt,
  resetAdminPassword,
  verifyAdminResetToken,
} from "@/lib/admin-users";
import { adminPasswordResetRateLimitKey } from "@/lib/request-ip";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { token?: string; password?: string } | null;
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const rateKey = adminPasswordResetRateLimitKey(request.headers, token);

  if (await isAdminLoginRateLimited(rateKey)) {
    return NextResponse.json({ error: ADMIN_LOGIN_TOO_MANY_ATTEMPTS_ERROR }, { status: 429 });
  }

  if (!token || !password) {
    await recordAdminFailedLoginAttempt(rateKey);
    return NextResponse.json({ error: "Token and password are required." }, { status: 400 });
  }

  const username = await verifyAdminResetToken(token);
  if (!username) {
    await recordAdminFailedLoginAttempt(rateKey);
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Ask an administrator for a new one." },
      { status: 400 },
    );
  }

  const passwordError = validateAdminPassword(password);
  if (passwordError) {
    await recordAdminFailedLoginAttempt(rateKey);
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  try {
    await resetAdminPassword(username, password);
  } catch (err) {
    await recordAdminFailedLoginAttempt(rateKey);
    const message = err instanceof Error ? err.message : "Unable to reset password.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
