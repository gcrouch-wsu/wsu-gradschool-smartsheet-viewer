import { NextResponse } from "next/server";
import {
  CONTRIBUTOR_TOO_MANY_ATTEMPTS_ERROR,
  isContributorRateLimited,
  recordContributorFailedAttempt,
} from "@/lib/contributor-auth";
import {
  getStudentConfigurationError,
  resetStudentPassword,
  validateStudentPassword,
  verifyStudentResetToken,
} from "@/lib/forms/student-users";
import { contributorAuthRateLimitKey } from "@/lib/request-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const configurationError = getStudentConfigurationError();
  if (configurationError) {
    return NextResponse.json({ error: configurationError }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { token?: unknown; password?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const rateLimitKey = contributorAuthRateLimitKey(request.headers, "student-password-reset");

  if (await isContributorRateLimited(rateLimitKey)) {
    return NextResponse.json({ error: CONTRIBUTOR_TOO_MANY_ATTEMPTS_ERROR }, { status: 429 });
  }

  const email = token ? await verifyStudentResetToken(token) : null;
  if (!email) {
    await recordContributorFailedAttempt(rateLimitKey);
    return NextResponse.json(
      { error: "This reset link is invalid or has already been used." },
      { status: 400 },
    );
  }

  const passwordError = validateStudentPassword(password);
  if (passwordError) {
    await recordContributorFailedAttempt(rateLimitKey);
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  await resetStudentPassword(email, password);
  return NextResponse.json({ ok: true });
}
