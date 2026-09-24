/**
 * Unified platform session cookie (reuses admin cookie name).
 * Env bootstrap owner keeps legacy admin session payload shape.
 * DB users use { kind: "platform", userId, credentialsVersion, ... }.
 */
import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_SECRET_ENV_VAR,
  ADMIN_SESSION_TTL_SECONDS,
  ADMIN_USERNAME_ENV_VAR,
  ADMIN_PASSWORD_ENV_VAR,
  type AdminSessionIdentity,
  type AdminSessionPayload,
  createAdminSessionToken,
  readAdminSessionToken,
  getAdminSessionCookieSettings,
} from "@/lib/admin-auth";
import { CONTRIBUTOR_SESSION_SECRET_ENV_VAR } from "@/lib/contributor-auth";

export { ADMIN_SESSION_COOKIE_NAME as PLATFORM_SESSION_COOKIE_NAME };
export { getAdminSessionCookieSettings as getPlatformSessionCookieSettings };

export const PLATFORM_SESSION_TTL_SECONDS = ADMIN_SESSION_TTL_SECONDS;

export interface PlatformSessionPayload {
  kind: "platform";
  userId: string;
  email: string;
  credentialsVersion: string;
  issuedAt: number;
  expiresAt: number;
}

export type UnifiedSessionPayload = AdminSessionPayload | PlatformSessionPayload;

export function isPlatformSessionPayload(payload: UnifiedSessionPayload): payload is PlatformSessionPayload {
  return "kind" in payload && payload.kind === "platform";
}

const encoder = new TextEncoder();

function getSessionSecret(): string | null {
  const configured = process.env[ADMIN_SESSION_SECRET_ENV_VAR]?.trim();
  if (configured) return configured;
  const contributor = process.env[CONTRIBUTOR_SESSION_SECRET_ENV_VAR]?.trim();
  if (contributor) return contributor;
  const student = process.env.STUDENT_SESSION_SECRET?.trim();
  if (student) return student;
  const username = process.env[ADMIN_USERNAME_ENV_VAR]?.trim();
  const password = process.env[ADMIN_PASSWORD_ENV_VAR] ?? "";
  if (username && password) {
    return `smartsheets-view-admin-session:${username}:${password}`;
  }
  return null;
}

function bytesToBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

function encodeBase64Url(value: string) {
  return bytesToBase64(encoder.encode(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
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
  return bytesToBase64(new Uint8Array(signature)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function createPlatformUserSessionToken(
  user: { id: string; email: string; updatedAt: string },
  expiresAt = Date.now() + PLATFORM_SESSION_TTL_SECONDS * 1000,
) {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error("Session secret is not configured.");
  }
  const payload: PlatformSessionPayload = {
    kind: "platform",
    userId: user.id,
    email: user.email,
    credentialsVersion: user.updatedAt,
    issuedAt: Date.now(),
    expiresAt,
  };
  const encoded = encodeBase64Url(JSON.stringify(payload));
  const signature = await signValue(encoded, secret);
  return `${encoded}.${signature}`;
}

/** Create session for env bootstrap admin (legacy shape). */
export async function createEnvAdminSessionToken(identity: AdminSessionIdentity) {
  return createAdminSessionToken(identity);
}

export async function readUnifiedSessionToken(
  sessionToken: string | undefined | null,
): Promise<
  | { ok: true; payload: UnifiedSessionPayload }
  | { ok: false; status: number; message: string }
> {
  if (!sessionToken) {
    return { ok: false, status: 401, message: "Authentication required." };
  }

  const secret = getSessionSecret();
  if (!secret) {
    // Fall back to admin reader (may use bootstrap-derived secret).
    const adminRead = await readAdminSessionToken(sessionToken);
    if (adminRead.ok && adminRead.payload) {
      return { ok: true, payload: adminRead.payload };
    }
    return {
      ok: false,
      status: adminRead.status ?? 503,
      message: adminRead.message ?? "Session secret is not configured.",
    };
  }

  const [encoded, signature] = sessionToken.split(".");
  if (!encoded || !signature) {
    return { ok: false, status: 401, message: "Authentication required." };
  }

  const expected = await signValue(encoded, secret);
  if (expected !== signature) {
    // Try legacy admin session (bootstrap-derived secret may differ).
    const adminRead = await readAdminSessionToken(sessionToken);
    if (adminRead.ok && adminRead.payload) {
      return { ok: true, payload: adminRead.payload };
    }
    return { ok: false, status: 401, message: "Authentication required." };
  }

  let parsed: Partial<PlatformSessionPayload & AdminSessionPayload>;
  try {
    parsed = JSON.parse(decodeBase64Url(encoded));
  } catch {
    return { ok: false, status: 401, message: "Authentication required." };
  }

  if (typeof parsed.expiresAt !== "number" || parsed.expiresAt < Date.now()) {
    return { ok: false, status: 401, message: "Session expired." };
  }

  if (parsed.kind === "platform") {
    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.credentialsVersion !== "string" ||
      typeof parsed.issuedAt !== "number"
    ) {
      return { ok: false, status: 401, message: "Authentication required." };
    }
    return {
      ok: true,
      payload: {
        kind: "platform",
        userId: parsed.userId,
        email: parsed.email,
        credentialsVersion: parsed.credentialsVersion,
        issuedAt: parsed.issuedAt,
        expiresAt: parsed.expiresAt,
      },
    };
  }

  // Legacy admin session shape
  if (
    typeof parsed.userId === "string" &&
    typeof parsed.username === "string" &&
    typeof parsed.role === "string" &&
    typeof parsed.source === "string" &&
    typeof parsed.version === "string" &&
    typeof parsed.issuedAt === "number"
  ) {
    return {
      ok: true,
      payload: {
        userId: parsed.userId,
        username: parsed.username,
        role: parsed.role as AdminSessionPayload["role"],
        source: parsed.source as AdminSessionPayload["source"],
        version: parsed.version,
        issuedAt: parsed.issuedAt,
        expiresAt: parsed.expiresAt,
      },
    };
  }

  return { ok: false, status: 401, message: "Authentication required." };
}
