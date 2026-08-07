import { NextResponse } from "next/server";
import {
  CONTRIBUTOR_CLAIM_ACCOUNT_EXISTS_ERROR,
  CONTRIBUTOR_SESSION_COOKIE_NAME,
  CONTRIBUTOR_TOO_MANY_ATTEMPTS_ERROR,
  createContributorSessionToken,
  createContributorUser,
  getContributorConfigurationError,
  getContributorSessionCookieSettings,
  getContributorUserByEmail,
  isContributorRateLimited,
  recordContributorFailedAttempt,
  validateContributorPassword,
} from "@/lib/contributor-auth";
import { isWsuEmail, normalizeContributorEmail } from "@/lib/contributor-utils";
import { ensureBootstrapped } from "@/lib/forms/init";
import { isStudentEligibleAnywhere } from "@/lib/forms/student-access";
import { contributorAuthRateLimitKey } from "@/lib/request-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}

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

  const passwordError = validateContributorPassword(password);
  if (passwordError) {
    await recordContributorFailedAttempt(rateLimitKey);
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  if (!isWsuEmail(email)) {
    await recordContributorFailedAttempt(rateLimitKey);
    return NextResponse.json(
      {
        error:
          "We could not verify this email as a Student Email on an available sheet. Use your @wsu.edu address from the sheet, or contact your coordinator.",
      },
      { status: 403 },
    );
  }

  const existingUser = await getContributorUserByEmail(email);
  if (existingUser) {
    return NextResponse.json({ error: CONTRIBUTOR_CLAIM_ACCOUNT_EXISTS_ERROR }, { status: 409 });
  }

  const eligible = await isStudentEligibleAnywhere(email);
  if (!eligible) {
    await recordContributorFailedAttempt(rateLimitKey);
    return NextResponse.json(
      {
        error:
          "We could not verify this email as a Student Email on an available sheet. Use your @wsu.edu address from the sheet, or contact your coordinator.",
      },
      { status: 403 },
    );
  }

  try {
    await createContributorUser(email, password);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: CONTRIBUTOR_CLAIM_ACCOUNT_EXISTS_ERROR }, { status: 409 });
    }
    throw error;
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    CONTRIBUTOR_SESSION_COOKIE_NAME,
    await createContributorSessionToken(email),
    getContributorSessionCookieSettings(),
  );
  return response;
}
