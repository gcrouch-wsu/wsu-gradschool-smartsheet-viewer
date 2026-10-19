import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  OKTA_STATE_COOKIE,
  isOktaConfigured,
  normalizeOktaNextPath,
  signInErrorRedirectPath,
} from "@/lib/okta/config";
import { issueSessionFromOktaIdentity } from "@/lib/okta/issue-session";
import {
  exchangeAuthorizationCode,
  fetchOidcDiscovery,
  requireOktaConfig,
  resolveOktaRedirectUri,
  verifyIdToken,
} from "@/lib/okta/oidc";
import { getOktaStateCookieSettings, readOktaStateCookieValue } from "@/lib/okta/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clearStateCookie(response: NextResponse) {
  response.cookies.set({
    ...getOktaStateCookieSettings(),
    value: "",
    maxAge: 0,
  });
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);

  if (!isOktaConfigured()) {
    return NextResponse.redirect(new URL("/admin/sign-in?error=Okta%20is%20not%20configured.", request.url));
  }

  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const oauthError = requestUrl.searchParams.get("error");
  const oauthDescription = requestUrl.searchParams.get("error_description");

  const cookieStore = await cookies();
  const stored = await readOktaStateCookieValue(cookieStore.get(OKTA_STATE_COOKIE)?.value);

  if (oauthError) {
    const intent = stored?.intent ?? "admin";
    const nextPath = normalizeOktaNextPath(stored?.next, intent);
    const dest = new URL(signInErrorRedirectPath(intent, nextPath), request.url);
    dest.searchParams.set("error", oauthDescription || oauthError);
    const response = NextResponse.redirect(dest);
    clearStateCookie(response);
    return response;
  }

  if (!code || !state || !stored || stored.state !== state) {
    const response = NextResponse.redirect(
      new URL("/admin/sign-in?error=Invalid%20or%20expired%20sign-in%20request.", request.url),
    );
    clearStateCookie(response);
    return response;
  }

  try {
    const config = requireOktaConfig();
    const discovery = await fetchOidcDiscovery(config.issuer);
    const redirectUri = resolveOktaRedirectUri(request.headers, request.url);
    const tokens = await exchangeAuthorizationCode({
      discovery,
      config,
      code,
      codeVerifier: stored.codeVerifier,
      redirectUri,
    });
    const identity = await verifyIdToken({
      discovery,
      config,
      idToken: tokens.id_token,
      nonce: stored.nonce,
    });

    const issued = await issueSessionFromOktaIdentity({
      email: identity.email,
      displayName: identity.name,
      intent: stored.intent,
      nextPath: stored.next,
      slug: stored.slug,
      viewId: stored.viewId,
    });

    if (!issued.ok) {
      const dest = new URL(signInErrorRedirectPath(stored.intent, stored.next), request.url);
      dest.searchParams.set("error", issued.message);
      const response = NextResponse.redirect(dest);
      clearStateCookie(response);
      return response;
    }

    const response = NextResponse.redirect(new URL(issued.redirectTo, request.url));
    issued.applyCookies(response);
    clearStateCookie(response);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Okta sign-in failed.";
    const dest = new URL(signInErrorRedirectPath(stored.intent, stored.next), request.url);
    dest.searchParams.set("error", message);
    const response = NextResponse.redirect(dest);
    clearStateCookie(response);
    return response;
  }
}
