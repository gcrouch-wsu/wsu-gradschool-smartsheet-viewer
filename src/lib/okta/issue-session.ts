/**
 * After Okta verifies identity, issue the same platform session cookies used by password login.
 */
import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_USERNAME_ENV_VAR,
  getAdminSessionCookieSettings,
} from "@/lib/admin-auth";
import {
  createAdminSessionForPrincipal,
  getBootstrapAdminPrincipal,
  type AdminAuthResult,
} from "@/lib/admin-users";
import {
  CONTRIBUTOR_SESSION_COOKIE_NAME,
  createContributorSessionToken,
  getContributorConfigurationError,
  getContributorSessionCookieSettings,
} from "@/lib/contributor-auth";
import { isContributorStillInSheet, isWsuEmail, normalizeContributorEmail } from "@/lib/contributor-utils";
import {
  CONTRIBUTOR_DATASET_OPTIONS,
  loadContributorDataset,
  loadContributorViewContext,
} from "@/lib/contributor-view";
import { ensureBootstrapped } from "@/lib/forms/init";
import { isStudentEligibleAnywhere } from "@/lib/forms/student-access";
import {
  STUDENT_SESSION_COOKIE_NAME,
  createStudentSessionToken,
  getStudentConfigurationError,
  getStudentSessionCookieSettings,
} from "@/lib/forms/student-users";
import type { OktaSignInIntent } from "@/lib/okta/config";
import { normalizeOktaNextPath } from "@/lib/okta/config";
import {
  addUserRole,
  ensurePlatformUserWithRole,
  getPlatformUserByEmail,
  primaryStaffRole,
  userHasStaffRole,
} from "@/lib/platform-users";

export type IssueOktaSessionResult =
  | { ok: true; redirectTo: string; applyCookies: (response: NextResponse) => void }
  | { ok: false; message: string; redirectTo: string };

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

async function resolveStaffByEmail(email: string): Promise<AdminAuthResult> {
  const normalized = normalizeUsername(email);
  const bootstrapUsername = process.env[ADMIN_USERNAME_ENV_VAR]?.trim();
  if (bootstrapUsername && normalizeUsername(bootstrapUsername) === normalized) {
    const principal = getBootstrapAdminPrincipal();
    if (principal) {
      return { ok: true, principal };
    }
  }

  const user = await getPlatformUserByEmail(normalized);
  if (!user || !user.isActive || !userHasStaffRole(user.roles)) {
    return {
      ok: false,
      status: 401,
      message: "No staff account is registered for this WSU email.",
    };
  }
  const staffRole = primaryStaffRole(user.roles);
  if (!staffRole) {
    return {
      ok: false,
      status: 401,
      message: "No staff account is registered for this WSU email.",
    };
  }
  return {
    ok: true,
    principal: {
      id: user.id,
      username: user.email,
      displayName: user.displayName,
      role: staffRole,
      source: "managed",
      version: user.updatedAt,
    },
  };
}

function clearLegacyRoleCookies(response: NextResponse) {
  response.cookies.set(STUDENT_SESSION_COOKIE_NAME, "", {
    ...getStudentSessionCookieSettings(),
    maxAge: 0,
  });
  response.cookies.set(CONTRIBUTOR_SESSION_COOKIE_NAME, "", {
    ...getContributorSessionCookieSettings(),
    maxAge: 0,
  });
}

export async function issueSessionFromOktaIdentity(input: {
  email: string;
  displayName?: string;
  intent: OktaSignInIntent;
  nextPath: string;
  slug?: string;
  viewId?: string;
}): Promise<IssueOktaSessionResult> {
  const email = normalizeContributorEmail(input.email);
  const nextPath = normalizeOktaNextPath(input.nextPath, input.intent);

  if (!isWsuEmail(email)) {
    return {
      ok: false,
      message: "Sign-in requires a @wsu.edu email address.",
      redirectTo: nextPath,
    };
  }

  if (input.intent === "admin") {
    const authorization = await resolveStaffByEmail(email);
    if (!authorization.ok || !authorization.principal) {
      return {
        ok: false,
        message: authorization.message ?? "Staff access denied.",
        redirectTo: `/admin/sign-in?next=${encodeURIComponent(nextPath)}`,
      };
    }

    const token = await createAdminSessionForPrincipal(authorization.principal);
    const redirectTo =
      authorization.principal.role === "coordinator" ? "/admin/sources" : nextPath;

    return {
      ok: true,
      redirectTo,
      applyCookies(response) {
        response.cookies.set({
          ...getAdminSessionCookieSettings(),
          name: ADMIN_SESSION_COOKIE_NAME,
          value: token,
        });
        clearLegacyRoleCookies(response);
      },
    };
  }

  if (input.intent === "student") {
    const configurationError = getStudentConfigurationError();
    if (configurationError) {
      return { ok: false, message: configurationError, redirectTo: "/student" };
    }

    await ensureBootstrapped();
    const eligible = await isStudentEligibleAnywhere(email);
    if (!eligible) {
      return {
        ok: false,
        message: "We could not verify this email as a Student Email on an available sheet.",
        redirectTo: "/student",
      };
    }

    const user = await ensurePlatformUserWithRole(email, "student", input.displayName);
    await addUserRole(user.id, "student");
    const token = await createStudentSessionToken(email);

    return {
      ok: true,
      redirectTo: nextPath.startsWith("/student") ? nextPath : "/student",
      applyCookies(response) {
        response.cookies.set({
          ...getAdminSessionCookieSettings(),
          name: ADMIN_SESSION_COOKIE_NAME,
          value: token,
        });
        clearLegacyRoleCookies(response);
      },
    };
  }

  // contributor
  const configurationError = getContributorConfigurationError();
  if (configurationError) {
    return { ok: false, message: configurationError, redirectTo: nextPath };
  }

  const slug = input.slug?.trim();
  if (!slug) {
    return {
      ok: false,
      message: "Contributor sign-in requires a view.",
      redirectTo: nextPath,
    };
  }

  const context = await loadContributorViewContext(slug, input.viewId ?? null);
  if (!context) {
    return { ok: false, message: "View not found.", redirectTo: "/" };
  }
  if (!context.activeView.editing?.enabled) {
    return {
      ok: false,
      message: "Editing is not enabled for this view.",
      redirectTo: `/view/${encodeURIComponent(slug)}`,
    };
  }

  const dataset = await loadContributorDataset(context.sourceConfig, CONTRIBUTOR_DATASET_OPTIONS);
  const isEligible = isContributorStillInSheet(
    dataset.rows,
    email,
    context.activeView.editing.contactColumnIds,
  );
  if (!isEligible) {
    return {
      ok: false,
      message: "We could not verify this email in the sheet contact columns for this view.",
      redirectTo: `/view/${encodeURIComponent(slug)}/contributor/login`,
    };
  }

  await ensurePlatformUserWithRole(email, "contributor", input.displayName);
  const user = await getPlatformUserByEmail(email);
  if (!user) {
    return {
      ok: false,
      message: "Unable to create contributor session.",
      redirectTo: `/view/${encodeURIComponent(slug)}/contributor/login`,
    };
  }
  await addUserRole(user.id, "contributor");
  const token = await createContributorSessionToken(email);

  const redirectTo =
    nextPath.startsWith(`/view/${slug}`) && !nextPath.includes("/contributor/login")
      ? nextPath
      : `/view/${encodeURIComponent(slug)}${input.viewId ? `?view=${encodeURIComponent(input.viewId)}` : ""}`;

  return {
    ok: true,
    redirectTo,
    applyCookies(response) {
      response.cookies.set({
        ...getAdminSessionCookieSettings(),
        name: ADMIN_SESSION_COOKIE_NAME,
        value: token,
      });
      clearLegacyRoleCookies(response);
    },
  };
}
