import { NextResponse } from "next/server";
import { clearAllAppSessionCookies } from "@/lib/okta/clear-session";
import { getOktaConfig, isOktaConfigured } from "@/lib/okta/config";
import { buildOktaLogoutUrl, fetchOidcDiscovery } from "@/lib/okta/oidc";
import { getPublicOrigin } from "@/lib/request-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safePostLogoutPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/admin/sign-in";
  }
  if (value.startsWith("/api/")) {
    return "/admin/sign-in";
  }
  return value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const nextPath = safePostLogoutPath(url.searchParams.get("next"));
  const localDestination = new URL(nextPath, request.url);

  const response = NextResponse.redirect(localDestination);
  clearAllAppSessionCookies(response);

  if (!isOktaConfigured()) {
    return response;
  }

  try {
    const config = getOktaConfig();
    if (!config) return response;
    const discovery = await fetchOidcDiscovery(config.issuer);
    const origin = getPublicOrigin(request.headers) ?? new URL(request.url).origin;
    const postLogoutRedirectUri = `${origin}${nextPath}`;
    const oktaLogout = buildOktaLogoutUrl({
      discovery,
      postLogoutRedirectUri,
    });
    if (!oktaLogout) {
      return response;
    }
    const oktaResponse = NextResponse.redirect(oktaLogout);
    clearAllAppSessionCookies(oktaResponse);
    return oktaResponse;
  } catch {
    return response;
  }
}
