/**
 * Okta OIDC configuration. When unset, local email/password login remains available.
 */

export const OKTA_ISSUER_ENV = "OKTA_ISSUER";
export const OKTA_CLIENT_ID_ENV = "OKTA_CLIENT_ID";
export const OKTA_CLIENT_SECRET_ENV = "OKTA_CLIENT_SECRET";

/** Must match the Sign-in redirect URI registered with ITS (WSU Okta). */
export const OKTA_CALLBACK_PATH = "/authorization-code/callback";
export const OKTA_START_PATH = "/api/auth/okta/start";
export const OKTA_LOGOUT_PATH = "/api/auth/okta/logout";
/** Must match the Sign-out redirect URI registered with ITS (site root). */
export const OKTA_POST_LOGOUT_PATH = "/";
export const OKTA_STATE_COOKIE = "smartsheets_view_okta_oidc";
/** Stores the OIDC ID token so logout can send id_token_hint (required by Okta). */
export const OKTA_ID_TOKEN_COOKIE = "smartsheets_view_okta_id_token";

export type OktaSignInIntent = "admin" | "student" | "contributor";

export interface OktaConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
}

export function isOktaConfigured(): boolean {
  return Boolean(
    process.env[OKTA_ISSUER_ENV]?.trim() &&
      process.env[OKTA_CLIENT_ID_ENV]?.trim() &&
      process.env[OKTA_CLIENT_SECRET_ENV]?.trim(),
  );
}

export function getOktaConfig(): OktaConfig | null {
  const issuer = process.env[OKTA_ISSUER_ENV]?.trim().replace(/\/+$/, "") ?? "";
  const clientId = process.env[OKTA_CLIENT_ID_ENV]?.trim() ?? "";
  const clientSecret = process.env[OKTA_CLIENT_SECRET_ENV]?.trim() ?? "";
  if (!issuer || !clientId || !clientSecret) {
    return null;
  }
  return { issuer, clientId, clientSecret };
}

export function parseOktaIntent(value: string | null | undefined): OktaSignInIntent {
  if (value === "student" || value === "contributor" || value === "admin") {
    return value;
  }
  return "admin";
}

/** Safe in-app return path after Okta completes. */
export function normalizeOktaNextPath(
  value: string | null | undefined,
  intent: OktaSignInIntent,
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    if (intent === "student") return "/student";
    if (intent === "contributor") return "/";
    return "/admin";
  }

  if (intent === "admin") {
    if (value.startsWith("/forms")) return "/admin/sources";
    if (!value.startsWith("/admin")) return "/admin";
    if (value === "/admin/sign-in" || value === "/admin/reset-password") return "/admin";
    return value;
  }

  if (intent === "student") {
    if (value.startsWith("/student") || value === "/notifications") return value;
    return "/student";
  }

  // contributor: allow return to public view or contributor login
  if (value.startsWith("/view/") || value.startsWith("/api/")) {
    return value.startsWith("/api/") ? "/" : value;
  }
  return value;
}

export function signInErrorRedirectPath(intent: OktaSignInIntent, nextPath: string): string {
  if (intent === "student") {
    return `/student?error=${encodeURIComponent("Sign-in failed. Try again or contact your coordinator.")}`;
  }
  if (intent === "contributor") {
    const base = nextPath.startsWith("/view/") ? nextPath.split("?")[0] ?? nextPath : "/";
    // Prefer contributor login page when we know the slug from next
    const match = nextPath.match(/^\/view\/([^/?]+)/);
    if (match?.[1]) {
      return `/view/${match[1]}/contributor/login?error=${encodeURIComponent("Sign-in failed. Use your @wsu.edu email from the sheet.")}`;
    }
    return `${base}?error=${encodeURIComponent("Sign-in failed.")}`;
  }
  return `/admin/sign-in?next=${encodeURIComponent(nextPath)}&error=${encodeURIComponent("Sign-in failed. You must already have a staff account.")}`;
}
