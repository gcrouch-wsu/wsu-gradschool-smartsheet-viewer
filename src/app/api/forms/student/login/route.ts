import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME, getAdminSessionCookieSettings } from "@/lib/admin-auth";
import {
  CONTRIBUTOR_TOO_MANY_ATTEMPTS_ERROR,
  isContributorRateLimited,
  recordContributorFailedAttempt,
} from "@/lib/contributor-auth";
import { isWsuEmail, normalizeContributorEmail } from "@/lib/contributor-utils";
import { ensureBootstrapped } from "@/lib/forms/init";
import { isStudentEligibleAnywhere } from "@/lib/forms/student-access";
import {
  STUDENT_GENERIC_LOGIN_ERROR,
  STUDENT_SESSION_COOKIE_NAME,
  createStudentSessionToken,
  getStudentConfigurationError,
  verifyStudentPassword,
} from "@/lib/forms/student-users";
import { addUserRole, getPlatformUserByEmail } from "@/lib/platform-users";
import { contributorAuthRateLimitKey } from "@/lib/request-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const configurationError = getStudentConfigurationError();
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

  const user = email ? await getPlatformUserByEmail(email) : null;
  const eligible = isWsuEmail(email) && (await isStudentEligibleAnywhere(email));

  if (
    !eligible ||
    !user ||
    !verifyStudentPassword(password, {
      passwordHash: user.passwordHash,
      passwordSalt: user.passwordSalt,
    })
  ) {
    await recordContributorFailedAttempt(rateLimitKey);
    return NextResponse.json({ error: STUDENT_GENERIC_LOGIN_ERROR }, { status: 401 });
  }

  await addUserRole(user.id, "student");

  const token = await createStudentSessionToken(email);
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    ...getAdminSessionCookieSettings(),
    name: ADMIN_SESSION_COOKIE_NAME,
    value: token,
  });
  response.cookies.set(STUDENT_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
  });
  return response;
}
