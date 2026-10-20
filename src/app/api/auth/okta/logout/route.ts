import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { clearAllAppSessionCookies } from "@/lib/okta/clear-session";
import {
  OKTA_ID_TOKEN_COOKIE,
  OKTA_POST_LOGOUT_PATH,
  getOktaConfig,
  isOktaConfigured,
} from "@/lib/okta/config";
import { buildOktaLogoutUrl, fetchOidcDiscovery } from "@/lib/okta/oidc";
import { getPublicOrigin } from "@/lib/request-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeLocalNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return OKTA_POST_LOGOUT_PATH;
  }
  if (value.startsWith("/api/")) {
    return OKTA_POST_LOGOUT_PATH;
  }
  return value;
}

/**
 * Clears app cookies, then ends the Okta session.
 * post_logout_redirect_uri must match ITS exactly: http://localhost:8080 (site root).
 * Okta /oauth2/v1/logout returns 400 without id_token_hint.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const localNext = safeLocalNextPath(url.searchParams.get("next"));
  const cookieStore = await cookies();
  const idToken = cookieStore.get(OKTA_ID_TOKEN_COOKIE)?.value ?? null;

  if (!isOktaConfigured()) {
    const response = NextResponse.redirect(new URL(localNext, request.url));
    clearAllAppSessionCookies(response);
    return response;
  }

  try {
    const config = getOktaConfig();
    if (!config) {
      const response = NextResponse.redirect(new URL(localNext, request.url));
      clearAllAppSessionCookies(response);
      return response;
    }

    const discovery = await fetchOidcDiscovery(config.issuer);
    const origin = getPublicOrigin(request.headers) ?? new URL(request.url).origin;
    // ITS registered the bare origin (no path). Avoid a trailing slash mismatch.
    const postLogoutRedirectUri = origin.replace(/\/+$/, "");
    const oktaLogout = buildOktaLogoutUrl({
      discovery,
      config,
      postLogoutRedirectUri,
      idToken,
    });

    if (!oktaLogout) {
      const response = NextResponse.redirect(new URL(OKTA_POST_LOGOUT_PATH, request.url));
      clearAllAppSessionCookies(response);
      return response;
    }

    const oktaResponse = NextResponse.redirect(oktaLogout);
    clearAllAppSessionCookies(oktaResponse);
    return oktaResponse;
  } catch {
    const response = NextResponse.redirect(new URL(OKTA_POST_LOGOUT_PATH, request.url));
    clearAllAppSessionCookies(response);
    return response;
  }
}
