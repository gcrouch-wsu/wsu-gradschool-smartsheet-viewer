/**
 * Short-lived signed cookie holding OIDC PKCE + return context across the Okta redirect.
 */
import {
  OKTA_STATE_COOKIE,
  type OktaSignInIntent,
  parseOktaIntent,
} from "@/lib/okta/config";
import {
  ADMIN_PASSWORD_ENV_VAR,
  ADMIN_SESSION_SECRET_ENV_VAR,
  ADMIN_USERNAME_ENV_VAR,
} from "@/lib/admin-auth";
import { CONTRIBUTOR_SESSION_SECRET_ENV_VAR } from "@/lib/contributor-auth";

const encoder = new TextEncoder();
const STATE_TTL_MS = 10 * 60 * 1000;

export interface OktaOidcStatePayload {
  state: string;
  nonce: string;
  codeVerifier: string;
  intent: OktaSignInIntent;
  next: string;
  slug?: string;
  viewId?: string;
  issuedAt: number;
  expiresAt: number;
}

function getSigningSecret(): string | null {
  const configured = process.env[ADMIN_SESSION_SECRET_ENV_VAR]?.trim();
  if (configured) return configured;
  const contributor = process.env[CONTRIBUTOR_SESSION_SECRET_ENV_VAR]?.trim();
  if (contributor) return contributor;
  const student = process.env.STUDENT_SESSION_SECRET?.trim();
  if (student) return student;
  const username = process.env[ADMIN_USERNAME_ENV_VAR]?.trim();
  const password = process.env[ADMIN_PASSWORD_ENV_VAR] ?? "";
  if (username && password) {
    return `smartsheets-view-okta-oidc:${username}:${password}`;
  }
  return process.env.OKTA_CLIENT_SECRET?.trim() || null;
}

function bytesToBase64Url(bytes: Uint8Array) {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function encodeBase64Url(value: string) {
  return bytesToBase64Url(encoder.encode(value));
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
  return Buffer.from(padded, "base64").toString("utf8");
}

async function signValue(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function createOktaStateCookieValue(
  input: Omit<OktaOidcStatePayload, "issuedAt" | "expiresAt">,
): Promise<string> {
  const secret = getSigningSecret();
  if (!secret) {
    throw new Error("Session secret is not configured for Okta sign-in.");
  }
  const now = Date.now();
  const payload: OktaOidcStatePayload = {
    ...input,
    intent: parseOktaIntent(input.intent),
    issuedAt: now,
    expiresAt: now + STATE_TTL_MS,
  };
  const encoded = encodeBase64Url(JSON.stringify(payload));
  const signature = await signValue(encoded, secret);
  return `${encoded}.${signature}`;
}

export async function readOktaStateCookieValue(
  cookieValue: string | undefined | null,
): Promise<OktaOidcStatePayload | null> {
  if (!cookieValue) return null;
  const secret = getSigningSecret();
  if (!secret) return null;

  const [encoded, signature] = cookieValue.split(".");
  if (!encoded || !signature) return null;

  const expected = await signValue(encoded, secret);
  if (expected.length !== signature.length) return null;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  if (mismatch !== 0) return null;

  try {
    const parsed = JSON.parse(decodeBase64Url(encoded)) as OktaOidcStatePayload;
    if (
      typeof parsed.state !== "string" ||
      typeof parsed.nonce !== "string" ||
      typeof parsed.codeVerifier !== "string" ||
      typeof parsed.next !== "string" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }
    if (parsed.expiresAt <= Date.now()) return null;
    return {
      ...parsed,
      intent: parseOktaIntent(parsed.intent),
      slug: typeof parsed.slug === "string" ? parsed.slug : undefined,
      viewId: typeof parsed.viewId === "string" ? parsed.viewId : undefined,
    };
  } catch {
    return null;
  }
}

export function getOktaStateCookieSettings() {
  return {
    httpOnly: true,
    maxAge: Math.floor(STATE_TTL_MS / 1000),
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    name: OKTA_STATE_COOKIE,
  };
}
