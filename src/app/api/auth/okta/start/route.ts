import { NextResponse } from "next/server";
import {
  isOktaConfigured,
  normalizeOktaNextPath,
  parseOktaIntent,
} from "@/lib/okta/config";
import {
  buildAuthorizationUrl,
  createOidcNonce,
  createOidcState,
  createPkcePair,
  fetchOidcDiscovery,
  requireOktaConfig,
  resolveOktaRedirectUri,
} from "@/lib/okta/oidc";
import { createOktaStateCookieValue, getOktaStateCookieSettings } from "@/lib/okta/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isOktaConfigured()) {
    return NextResponse.json({ message: "Okta is not configured." }, { status: 503 });
  }

  const url = new URL(request.url);
  const intent = parseOktaIntent(url.searchParams.get("intent"));
  const nextPath = normalizeOktaNextPath(url.searchParams.get("next"), intent);
  const slug = url.searchParams.get("slug")?.trim() || undefined;
  const viewId = url.searchParams.get("view")?.trim() || undefined;

  if (intent === "contributor" && !slug) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  try {
    const config = requireOktaConfig();
    const discovery = await fetchOidcDiscovery(config.issuer);
    const { verifier, challenge } = createPkcePair();
    const state = createOidcState();
    const nonce = createOidcNonce();
    const redirectUri = resolveOktaRedirectUri(request.headers, request.url);

    const cookieValue = await createOktaStateCookieValue({
      state,
      nonce,
      codeVerifier: verifier,
      intent,
      next: nextPath,
      slug,
      viewId,
    });

    const authorizationUrl = buildAuthorizationUrl({
      discovery,
      config,
      redirectUri,
      state,
      nonce,
      codeChallenge: challenge,
    });

    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set({
      ...getOktaStateCookieSettings(),
      value: cookieValue,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start Okta sign-in.";
    const fallback =
      intent === "student"
        ? "/student"
        : intent === "contributor" && slug
          ? `/view/${encodeURIComponent(slug)}/contributor/login`
          : `/admin/sign-in?next=${encodeURIComponent(nextPath)}`;
    const dest = new URL(fallback, request.url);
    dest.searchParams.set("error", message);
    return NextResponse.redirect(dest);
  }
}
