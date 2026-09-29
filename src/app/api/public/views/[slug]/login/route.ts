import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME, getAdminSessionCookieSettings } from "@/lib/admin-auth";
import {
  CONTRIBUTOR_GENERIC_LOGIN_ERROR,
  CONTRIBUTOR_SESSION_COOKIE_NAME,
  CONTRIBUTOR_TOO_MANY_ATTEMPTS_ERROR,
  createContributorSessionToken,
  getContributorConfigurationError,
  isContributorRateLimited,
  recordContributorFailedAttempt,
  verifyContributorPassword,
} from "@/lib/contributor-auth";
import { isContributorStillInSheet, isWsuEmail, normalizeContributorEmail } from "@/lib/contributor-utils";
import { CONTRIBUTOR_DATASET_OPTIONS, loadContributorDataset, loadContributorViewContext } from "@/lib/contributor-view";
import { contributorAuthRateLimitKey } from "@/lib/request-ip";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const configurationError = getContributorConfigurationError();
  if (configurationError) {
    return NextResponse.json({ error: configurationError }, { status: 503 });
  }

  const { slug } = await params;
  const url = new URL(request.url);
  const requestedViewId = url.searchParams.get("view");
  const body = (await request.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  const email = normalizeContributorEmail(typeof body?.email === "string" ? body.email : "");
  const password = typeof body?.password === "string" ? body.password : "";
  const rateLimitKey = contributorAuthRateLimitKey(request.headers, email);

  if (await isContributorRateLimited(rateLimitKey)) {
    return NextResponse.json({ error: CONTRIBUTOR_TOO_MANY_ATTEMPTS_ERROR }, { status: 429 });
  }

  const context = await loadContributorViewContext(slug, requestedViewId);
  if (!context) {
    return NextResponse.json({ error: "View not found." }, { status: 404 });
  }

  if (!context.activeView.editing?.enabled) {
    return NextResponse.json({ error: "Editing not enabled for this view." }, { status: 400 });
  }

  const dataset = await loadContributorDataset(context.sourceConfig, CONTRIBUTOR_DATASET_OPTIONS);
  const { getPlatformUserByEmail, addUserRole } = await import("@/lib/platform-users");
  const user = email ? await getPlatformUserByEmail(email) : null;
  const isEligible =
    isWsuEmail(email) &&
    isContributorStillInSheet(dataset.rows, email, context.activeView.editing.contactColumnIds);

  if (
    !isEligible ||
    !user ||
    !verifyContributorPassword(password, {
      passwordHash: user.passwordHash,
      passwordSalt: user.passwordSalt,
    })
  ) {
    await recordContributorFailedAttempt(rateLimitKey);
    return NextResponse.json({ error: CONTRIBUTOR_GENERIC_LOGIN_ERROR }, { status: 401 });
  }

  await addUserRole(user.id, "contributor");

  const token = await createContributorSessionToken(email);
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    ...getAdminSessionCookieSettings(),
    name: ADMIN_SESSION_COOKIE_NAME,
    value: token,
  });
  response.cookies.set(CONTRIBUTOR_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
  });
  return response;
}
