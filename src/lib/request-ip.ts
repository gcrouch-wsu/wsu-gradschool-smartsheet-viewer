const TRUST_PROXY_HEADERS_ENV_VAR = "SMARTSHEETS_VIEW_TRUST_PROXY_HEADERS";
const PUBLIC_BASE_URL_ENV_VAR = "SMARTSHEETS_VIEW_PUBLIC_BASE_URL";

function parseBooleanEnv(value: string | undefined): boolean | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return null;
}

export function shouldTrustProxyHeaders(): boolean {
  const explicit = parseBooleanEnv(process.env[TRUST_PROXY_HEADERS_ENV_VAR]);
  if (explicit !== null) {
    return explicit;
  }

  return Boolean(
    process.env.RAILWAY_ENVIRONMENT?.trim() ||
      process.env.RAILWAY_PROJECT_ID?.trim() ||
      process.env.VERCEL?.trim() ||
      process.env.VERCEL_ENV?.trim(),
  );
}

function firstHeaderValue(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const first = value.split(",")[0]?.trim();
  return first || null;
}

function normalizeHttpOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function getConfiguredPublicOrigin(): string | null {
  const raw = process.env[PUBLIC_BASE_URL_ENV_VAR]?.trim();
  return raw ? normalizeHttpOrigin(raw) : null;
}

/**
 * Best-effort client IP from trusted reverse-proxy headers only.
 * On unknown/self-hosted stacks, forwarded headers are ignored by default unless explicitly enabled.
 */
export function getTrustedClientIp(requestHeaders: Headers): string {
  if (!shouldTrustProxyHeaders()) {
    return "unknown";
  }

  const forwardedFor = requestHeaders.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  return requestHeaders.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Resolve the public origin used for user-facing absolute links.
 * Prefer an explicit public base URL, otherwise trust forwarded host/proto only on known-safe proxy setups.
 */
/**
 * When the client IP cannot be trusted, avoid a shared global bucket: rate-limit per username (admin)
 * or per email (contributor) so one subnet cannot lock out everyone.
 */
export function adminAuthRateLimitKey(headers: Headers, usernameForLimiting: string): string {
  const ip = getTrustedClientIp(headers);
  if (ip !== "unknown") {
    return ip;
  }
  const u = usernameForLimiting.trim().toLowerCase();
  return u ? `username:${u}` : "unknown:no-username";
}

export function contributorAuthRateLimitKey(headers: Headers, emailForLimiting: string): string {
  const ip = getTrustedClientIp(headers);
  if (ip !== "unknown") {
    return ip;
  }
  const e = emailForLimiting.trim().toLowerCase();
  return e ? `email:${e}` : "unknown:no-email";
}

/**
 * Password reset has no email until the token is verified — bucket by IP when trusted,
 * otherwise by a stable hash of the token so unrelated users do not share one "unknown" bucket.
 */
export function contributorPasswordResetRateLimitKey(headers: Headers, resetToken: string): string {
  const ip = getTrustedClientIp(headers);
  if (ip !== "unknown") {
    return `pwreset-ip:${ip}`;
  }
  const t = resetToken.trim();
  if (!t) {
    return "pwreset:empty-token";
  }
  let h = 0;
  for (let i = 0; i < t.length; i += 1) {
    h = (h * 31 + t.charCodeAt(i)) | 0;
  }
  const bucket = (h >>> 0).toString(16).padStart(8, "0");
  return `pwreset:${bucket}:${t.length}`;
}

/** Same bucketing as contributor password reset (IP when trusted, else token hash). */
export function adminPasswordResetRateLimitKey(headers: Headers, resetToken: string): string {
  return contributorPasswordResetRateLimitKey(headers, resetToken);
}

export function getPublicOrigin(requestHeaders: Headers): string | null {
  const configured = getConfiguredPublicOrigin();
  if (configured) {
    return configured;
  }

  if (!shouldTrustProxyHeaders()) {
    return null;
  }

  const forwardedHost = firstHeaderValue(requestHeaders.get("x-forwarded-host"));
  const host = forwardedHost ?? firstHeaderValue(requestHeaders.get("host"));
  if (!host) {
    return null;
  }

  const forwardedProto = firstHeaderValue(requestHeaders.get("x-forwarded-proto"))?.toLowerCase();
  const proto = forwardedProto ?? (forwardedHost ? "https" : "http");
  if (proto !== "http" && proto !== "https") {
    return null;
  }

  return normalizeHttpOrigin(`${proto}://${host}`);
}
