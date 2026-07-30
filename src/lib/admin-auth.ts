export const ADMIN_USERNAME_ENV_VAR = "SMARTSHEETS_VIEW_ADMIN_USERNAME";
export const ADMIN_PASSWORD_ENV_VAR = "SMARTSHEETS_VIEW_ADMIN_PASSWORD";
export const ADMIN_SESSION_SECRET_ENV_VAR = "SMARTSHEETS_VIEW_ADMIN_SESSION_SECRET";
export const ADMIN_SESSION_COOKIE_NAME = "smartsheets_view_admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12;
export const ADMIN_PASSWORD_POLICY_MESSAGE =
  "Admin password must be at least 8 characters long and include one uppercase letter, one number, and one special character such as !, *, or _.";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type AdminRole = "owner" | "admin";
export type AdminUserSource = "env" | "managed";

export interface AdminAuthorizationResult {
  ok: boolean;
  status?: number;
  message?: string;
}

export interface AdminSessionIdentity {
  userId: string;
  username: string;
  role: AdminRole;
  source: AdminUserSource;
  version: string;
}

export interface AdminSessionPayload extends AdminSessionIdentity {
  issuedAt: number;
  expiresAt: number;
}

export interface AdminSessionReadResult {
  ok: boolean;
  payload?: AdminSessionPayload;
  status?: number;
  message?: string;
}

interface BootstrapCredentials {
  username: string;
  password: string;
}

function timingSafeEqual(left: string, right: string) {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);
  let mismatch = leftBytes.length === rightBytes.length ? 0 : 1;

  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return mismatch === 0;
}

function bytesToBase64(bytes: Uint8Array) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToBytes(base64: string) {
  const normalized = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;

  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(normalized, "base64"));
  }

  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function encodeBase64Url(value: string) {
  return bytesToBase64(encoder.encode(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return decoder.decode(base64ToBytes(base64));
}

function getBootstrapCredentials(): BootstrapCredentials | null {
  const username = process.env[ADMIN_USERNAME_ENV_VAR]?.trim();
  const password = process.env[ADMIN_PASSWORD_ENV_VAR] ?? "";

  if (!username || !password) {
    return null;
  }

  return { username, password };
}

function getSessionSecret() {
  const configuredSecret = process.env[ADMIN_SESSION_SECRET_ENV_VAR]?.trim();
  if (configuredSecret) {
    return configuredSecret;
  }

  const bootstrap = getBootstrapCredentials();
  const configurationError = getAdminConfigurationError();
  if (!bootstrap || configurationError) {
    return null;
  }

  return `smartsheets-view-admin-session:${bootstrap.username}:${bootstrap.password}`;
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

export function validateAdminPassword(password: string) {
  if (password.length < 8) {
    return ADMIN_PASSWORD_POLICY_MESSAGE;
  }

  if (!/[A-Z]/.test(password)) {
    return ADMIN_PASSWORD_POLICY_MESSAGE;
  }

  if (!/\d/.test(password)) {
    return ADMIN_PASSWORD_POLICY_MESSAGE;
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return ADMIN_PASSWORD_POLICY_MESSAGE;
  }

  return null;
}

export function getAdminConfigurationError() {
  const bootstrap = getBootstrapCredentials();
  if (!bootstrap) {
    return `Admin authentication is not configured. Set ${ADMIN_USERNAME_ENV_VAR} and ${ADMIN_PASSWORD_ENV_VAR}.`;
  }

  const passwordError = validateAdminPassword(bootstrap.password);
  if (passwordError) {
    return `${passwordError} Update ${ADMIN_PASSWORD_ENV_VAR}.`;
  }

  if (process.env[ADMIN_SESSION_SECRET_ENV_VAR] !== undefined && !process.env[ADMIN_SESSION_SECRET_ENV_VAR]?.trim()) {
    return `${ADMIN_SESSION_SECRET_ENV_VAR} cannot be empty when set.`;
  }

  return null;
}

export async function createAdminSessionToken(
  identity: AdminSessionIdentity,
  expiresAt = Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000,
) {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error(getAdminConfigurationError() ?? "Admin authentication is not configured.");
  }

  const payload = encodeBase64Url(
    JSON.stringify({
      ...identity,
      issuedAt: Date.now(),
      expiresAt,
    } satisfies AdminSessionPayload),
  );
  const signature = await signValue(payload, secret);
  return `${payload}.${signature}`;
}

export async function readAdminSessionToken(sessionToken: string | undefined | null): Promise<AdminSessionReadResult> {
  const configurationError = getAdminConfigurationError();
  if (configurationError) {
    return {
      ok: false,
      status: 503,
      message: configurationError,
    };
  }

  const secret = getSessionSecret();
  if (!secret) {
    return {
      ok: false,
      status: 503,
      message: getAdminConfigurationError() ?? "Admin authentication is not configured.",
    };
  }

  if (!sessionToken) {
    return {
      ok: false,
      status: 401,
      message: "Authentication required.",
    };
  }

  const [payload, signature] = sessionToken.split(".");
  if (!payload || !signature) {
    return {
      ok: false,
      status: 401,
      message: "Authentication required.",
    };
  }

  const expectedSignature = await signValue(payload, secret);
  if (!timingSafeEqual(signature, expectedSignature)) {
    return {
      ok: false,
      status: 401,
      message: "Authentication required.",
    };
  }

  try {
    const decoded = JSON.parse(decodeBase64Url(payload)) as Partial<AdminSessionPayload>;
    const hasValidRole = decoded.role === "owner" || decoded.role === "admin";
    const hasValidSource = decoded.source === "env" || decoded.source === "managed";

    if (
      typeof decoded.userId !== "string" ||
      typeof decoded.username !== "string" ||
      typeof decoded.version !== "string" ||
      !hasValidRole ||
      !hasValidSource ||
      typeof decoded.issuedAt !== "number" ||
      typeof decoded.expiresAt !== "number"
    ) {
      return {
        ok: false,
        status: 401,
        message: "Authentication required.",
      };
    }

    if (decoded.expiresAt <= Date.now()) {
      return {
        ok: false,
        status: 401,
        message: "Session expired. Sign in again.",
      };
    }

    return {
      ok: true,
      payload: decoded as AdminSessionPayload,
    };
  } catch {
    return {
      ok: false,
      status: 401,
      message: "Authentication required.",
    };
  }
}

export async function authorizeAdminSession(sessionToken: string | undefined | null): Promise<AdminAuthorizationResult> {
  const result = await readAdminSessionToken(sessionToken);
  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      message: result.message,
    };
  }

  return { ok: true };
}

export function getAdminSessionCookieSettings() {
  return {
    httpOnly: true,
    maxAge: ADMIN_SESSION_TTL_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export function normalizeAdminNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/admin";
  }

  if (!value.startsWith("/admin") && !value.startsWith("/forms")) {
    return "/admin";
  }

  if (value === "/admin/sign-in" || value === "/admin/reset-password" || value === "/forms/approver/sign-in") {
    return "/admin";
  }

  return value;
}