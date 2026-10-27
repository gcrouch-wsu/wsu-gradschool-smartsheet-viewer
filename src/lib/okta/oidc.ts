/**
 * Minimal OIDC authorization-code + PKCE helpers for Okta (no session library).
 */
import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { getOktaConfig, OKTA_CALLBACK_PATH, type OktaConfig } from "@/lib/okta/config";
import { getPublicOrigin } from "@/lib/request-ip";

export interface OidcDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  end_session_endpoint?: string;
  userinfo_endpoint?: string;
  issuer: string;
}

export interface OktaTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
}

export interface VerifiedOktaIdentity {
  email: string;
  name?: string;
  sub: string;
}

const discoveryCache = new Map<string, { at: number; doc: OidcDiscovery }>();
const DISCOVERY_TTL_MS = 60 * 60 * 1000;

function base64Url(buffer: Buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function createPkcePair() {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function createOidcNonce() {
  return base64Url(randomBytes(24));
}

export function createOidcState() {
  return base64Url(randomBytes(24));
}

export async function fetchOidcDiscovery(issuer: string): Promise<OidcDiscovery> {
  const cached = discoveryCache.get(issuer);
  if (cached && Date.now() - cached.at < DISCOVERY_TTL_MS) {
    return cached.doc;
  }

  const url = `${issuer}/.well-known/openid-configuration`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to load Okta discovery document (${response.status}).`);
  }
  const doc = (await response.json()) as OidcDiscovery;
  if (!doc.authorization_endpoint || !doc.token_endpoint || !doc.jwks_uri) {
    throw new Error("Okta discovery document is missing required endpoints.");
  }
  discoveryCache.set(issuer, { at: Date.now(), doc });
  return doc;
}

export function resolveOktaRedirectUri(requestHeaders: Headers, requestUrl: string): string {
  const configured = getPublicOrigin(requestHeaders);
  if (configured) {
    return `${configured}${OKTA_CALLBACK_PATH}`;
  }
  const origin = new URL(requestUrl).origin;
  return `${origin}${OKTA_CALLBACK_PATH}`;
}

export function buildAuthorizationUrl(input: {
  discovery: OidcDiscovery;
  config: OktaConfig;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}): string {
  const url = new URL(input.discovery.authorization_endpoint);
  url.searchParams.set("client_id", input.config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("nonce", input.nonce);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export async function exchangeAuthorizationCode(input: {
  discovery: OidcDiscovery;
  config: OktaConfig;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<OktaTokenResponse> {
  // Okta web apps typically expect client_secret_basic (HTTP Basic), not secret in the body.
  const basic = Buffer.from(
    `${input.config.clientId}:${input.config.clientSecret}`,
    "utf8",
  ).toString("base64");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.codeVerifier,
  });

  const response = await fetch(input.discovery.token_endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    let detail = "";
    try {
      const failure = (await response.json()) as {
        error?: string;
        error_description?: string;
      };
      detail = [failure.error, failure.error_description].filter(Boolean).join(": ");
    } catch {
      detail = (await response.text().catch(() => "")).slice(0, 200);
    }
    console.error("[okta] token exchange failed", {
      status: response.status,
      detail,
      tokenEndpoint: input.discovery.token_endpoint,
      redirectUri: input.redirectUri,
    });
    throw new Error(
      detail
        ? `Okta token exchange failed (${response.status}): ${detail}`
        : `Okta token exchange failed (${response.status}).`,
    );
  }

  const tokens = (await response.json()) as OktaTokenResponse;
  if (!tokens.id_token) {
    throw new Error("Okta token response did not include an ID token.");
  }
  return tokens;
}

export async function verifyIdToken(input: {
  discovery: OidcDiscovery;
  config: OktaConfig;
  idToken: string;
  nonce: string;
}): Promise<VerifiedOktaIdentity> {
  const jwks = createRemoteJWKSet(new URL(input.discovery.jwks_uri));
  const { payload } = await jwtVerify(input.idToken, jwks, {
    issuer: input.discovery.issuer || input.config.issuer,
    audience: input.config.clientId,
  });

  if (payload.nonce !== input.nonce) {
    throw new Error("Okta ID token nonce mismatch.");
  }

  const emailRaw =
    typeof payload.email === "string"
      ? payload.email
      : typeof payload.preferred_username === "string"
        ? payload.preferred_username
        : "";
  const email = emailRaw.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Okta ID token did not include a usable email claim.");
  }

  const sub = typeof payload.sub === "string" ? payload.sub : "";
  if (!sub) {
    throw new Error("Okta ID token did not include a subject.");
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : undefined;
  return { email, name: name || undefined, sub };
}

export function buildOktaLogoutUrl(input: {
  discovery: OidcDiscovery;
  config: OktaConfig;
  postLogoutRedirectUri: string;
  idToken?: string | null;
}): string | null {
  // Okta RP-initiated logout requires id_token_hint; without it /oauth2/v1/logout returns 400.
  if (input.idToken && input.discovery.end_session_endpoint) {
    const url = new URL(input.discovery.end_session_endpoint);
    url.searchParams.set("id_token_hint", input.idToken);
    url.searchParams.set("post_logout_redirect_uri", input.postLogoutRedirectUri);
    url.searchParams.set("client_id", input.config.clientId);
    return url.toString();
  }

  // Fallback: classic Okta sign-out (no id_token_hint). fromURI must be allow-listed as a sign-out redirect.
  try {
    const issuerHost = new URL(input.config.issuer).origin;
    const url = new URL("/login/signout", issuerHost);
    url.searchParams.set("fromURI", input.postLogoutRedirectUri);
    return url.toString();
  } catch {
    return null;
  }
}

export function getOktaIdTokenCookieSettings() {
  return {
    httpOnly: true,
    // Keep for the same window as the platform session.
    maxAge: 60 * 60 * 12,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export function requireOktaConfig(): OktaConfig {
  const config = getOktaConfig();
  if (!config) {
    throw new Error("Okta is not configured.");
  }
  return config;
}
