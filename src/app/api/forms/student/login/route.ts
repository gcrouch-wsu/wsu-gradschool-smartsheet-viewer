import { NextResponse } from "next/server";
import {
  CONTRIBUTOR_GENERIC_LOGIN_ERROR,
  CONTRIBUTOR_SESSION_COOKIE_NAME,
  CONTRIBUTOR_TOO_MANY_ATTEMPTS_ERROR,
  createContributorSessionToken,
  getContributorConfigurationError,
  getContributorSessionCookieSettings,
  getContributorUserByEmail,
  isContributorRateLimited,
  recordContributorFailedAttempt,
  verifyContributorPassword,
} from "@/lib/contributor-auth";
import { isWsuEmail, normalizeContributorEmail } from "@/lib/contributor-utils";
import { ensureBootstrapped } from "@/lib/forms/init";
import { isStudentEligibleAnywhere } from "@/lib/forms/student-access";
import { contributorAuthRateLimitKey } from "@/lib/request-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const configurationError = getContributorConfigurationError();
  if (configurationError) {
    return NextResponse.json({ error: configurationError }, { status: 503 });
  }

  await ensureBootstrapped();

  const body = (await request.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  const email = normalizeContributorEmail(typeof body?.email === "string" ? body.email : "");
  const password = typeof body?.password === "string" ? body.password : "";
  const rateLimitKey = contributorAuthRateLimitKey(request.headers, email);

  if (await isContributorRateLimited(rateLimitKey)) {
    return NextResponse.json({ error: CONTRIBUTOR_TOO_MANY_ATTEMPTS_ERROR }, { status: 429 });
  }

  const user = email ? await getContributorUserByEmail(email) : null;
  const eligible = isWsuEmail(email) && (await isStudentEligibleAnywhere(email));

  if (!eligible || !user || !verifyContributorPassword(password, user)) {
    await recordContributorFailedAttempt(rateLimitKey);
    return NextResponse.json({ error: CONTRIBUTOR_GENERIC_LOGIN_ERROR }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    CONTRIBUTOR_SESSION_COOKIE_NAME,
    await createContributorSessionToken(email),
    getContributorSessionCookieSettings(),
  );
  return response;
}
