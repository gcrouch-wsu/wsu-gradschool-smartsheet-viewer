import { NextResponse } from "next/server";
import {
  CONTRIBUTOR_CLAIM_NOT_ELIGIBLE_ERROR,
  CONTRIBUTOR_TOO_MANY_ATTEMPTS_ERROR,
  getContributorConfigurationError,
  getContributorUserByEmail,
  isContributorRateLimited,
  recordContributorFailedAttempt,
} from "@/lib/contributor-auth";
import { isContributorStillInSheet, isWsuEmail, normalizeContributorEmail } from "@/lib/contributor-utils";
import { CONTRIBUTOR_DATASET_OPTIONS, loadContributorDataset, loadContributorViewContext } from "@/lib/contributor-view";
import { contributorAuthRateLimitKey } from "@/lib/request-ip";

export const runtime = "nodejs";

/**
 * Email-first lookup: same eligibility rules as claim/login (@wsu.edu + contact field).
 * Only difference from the old UI: picks sign_in vs claim automatically.
 */
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
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = normalizeContributorEmail(typeof body?.email === "string" ? body.email : "");
  const rateLimitKey = contributorAuthRateLimitKey(request.headers, email || "access-status");

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

  if (!email || !isWsuEmail(email)) {
    await recordContributorFailedAttempt(rateLimitKey);
    return NextResponse.json(
      { error: "Enter a valid @wsu.edu email address." },
      { status: 400 },
    );
  }

  const dataset = await loadContributorDataset(context.sourceConfig, CONTRIBUTOR_DATASET_OPTIONS);
  const isEligible = isContributorStillInSheet(
    dataset.rows,
    email,
    context.activeView.editing.contactColumnIds,
  );

  if (!isEligible) {
    await recordContributorFailedAttempt(rateLimitKey);
    return NextResponse.json({ error: CONTRIBUTOR_CLAIM_NOT_ELIGIBLE_ERROR }, { status: 403 });
  }

  const existingUser = await getContributorUserByEmail(email);
  return NextResponse.json({
    mode: existingUser ? "sign_in" : "claim",
  });
}
