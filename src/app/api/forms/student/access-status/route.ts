import { NextResponse } from "next/server";
import {
  CONTRIBUTOR_TOO_MANY_ATTEMPTS_ERROR,
  isContributorRateLimited,
  recordContributorFailedAttempt,
} from "@/lib/contributor-auth";
import { isWsuEmail, normalizeContributorEmail } from "@/lib/contributor-utils";
import { ensureBootstrapped } from "@/lib/forms/init";
import { isStudentEligibleAnywhere } from "@/lib/forms/student-access";
import {
  getStudentConfigurationError,
  getStudentUserByEmail,
} from "@/lib/forms/student-users";
import { contributorAuthRateLimitKey } from "@/lib/request-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const configurationError = getStudentConfigurationError();
  if (configurationError) {
    return NextResponse.json({ error: configurationError }, { status: 503 });
  }

  await ensureBootstrapped();

  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = normalizeContributorEmail(typeof body?.email === "string" ? body.email : "");
  const rateLimitKey = contributorAuthRateLimitKey(request.headers, email || "student-access-status");

  if (await isContributorRateLimited(rateLimitKey)) {
    return NextResponse.json({ error: CONTRIBUTOR_TOO_MANY_ATTEMPTS_ERROR }, { status: 429 });
  }

  if (!email || !isWsuEmail(email)) {
    await recordContributorFailedAttempt(rateLimitKey);
    return NextResponse.json({ error: "Enter a valid @wsu.edu email address." }, { status: 400 });
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

  const existingUser = await getStudentUserByEmail(email);
  return NextResponse.json({
    mode: existingUser ? "sign_in" : "claim",
  });
}
