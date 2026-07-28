import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { validateAdminPassword } from "@/lib/admin-auth";
import { ensureConfigTables, isDatabaseConfigEnabled, queryConfigDb } from "@/lib/config/config-db";
import { getTrustedClientIp } from "@/lib/request-ip";
import { isWsuEmail, normalizeContributorEmail } from "@/lib/contributor-utils";

export const CONTRIBUTOR_SESSION_COOKIE_NAME = "smartsheets_view_contributor_session";
export const CONTRIBUTOR_SESSION_SECRET_ENV_VAR = "CONTRIBUTOR_SESSION_SECRET";
export const CONTRIBUTOR_SESSION_TTL_ENV_VAR = "CONTRIBUTOR_SESSION_TTL_SECONDS";
export const CONTRIBUTOR_DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 4;
export const CONTRIBUTOR_RATE_LIMIT_MAX_ATTEMPTS = 5;
export const CONTRIBUTOR_RATE_LIMIT_WINDOW_MINUTES = 15;
export const CONTRIBUTOR_GENERIC_LOGIN_ERROR = "Invalid email or password.";
export const CONTRIBUTOR_GENERIC_CLAIM_ERROR =
  "Unable to set password. Use sign in if you already have access or contact your coordinator.";
/** Claim attempted when this email already has a contributor account. */
export const CONTRIBUTOR_CLAIM_ACCOUNT_EXISTS_ERROR =
  "An account already exists for this email. Go back and continue again to sign in with your password.";
/** Email not found in configured contact columns for this view (or not a @wsu.edu address). */
export const CONTRIBUTOR_CLAIM_NOT_ELIGIBLE_ERROR =
  "We could not verify this email in the sheet contact columns for this view. Use the same @wsu.edu address as in the sheet, or contact your coordinator.";
export const CONTRIBUTOR_TOO_MANY_ATTEMPTS_ERROR = "Too many attempts. Try again later.";

export interface ContributorSessionPayload {
  email: string;
  issuedAt: number;
  expiresAt: number;
  /** Same as `ContributorUserRecord.updatedAt` when the token was issued; revokes cookie after password reset. */
  credentialsVersion: string;
}

export interface ContributorSessionReadResult {
  ok: boolean;
  payload?: ContributorSessionPayload;
  status?: number;
  message?: string;
}

interface ContributorUserDbRow {
  id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface ContributorUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
  updatedAt: string;
}

function getContributorSessionSecret() {
  return process.env[CONTRIBUTOR_SESSION_SECRET_ENV_VAR]?.trim() ?? "";
}

export function getContributorSessionTtlSeconds() {
  const raw = process.env[CONTRIBUTOR_SESSION_TTL_ENV_VAR]?.trim();
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : CONTRIBUTOR_DEFAULT_SESSION_TTL_SECONDS;
}

export function getContributorConfigurationError() {
  if (!isDatabaseConfigEnabled()) {
    return "Contributor editing requires DATABASE_URL.";
  }

  if (!getContributorSessionSecret()) {
    return `${CONTRIBUTOR_SESSION_SECRET_ENV_VAR} is required for contributor editing.`;
  }

  return null;
}

function encodePayload(payload: ContributorSessionPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<ContributorSessionPayload>;
}

function signPayload(payload: string) {
  return createHmac("sha256", getContributorSessionSecret()).update(payload).digest("base64url");
}

function toIsoTimestamp(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toContributorUserRecord(row: ContributorUserDbRow): ContributorUserRecord {
  return {
    id: row.id,
    email: normalizeContributorEmail(row.email),
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    createdAt: toIsoTimestamp(row.created_at),
    updatedAt: toIsoTimestamp(row.updated_at),
  };
}

async function ensureContributorAuthStorage() {
  const configurationError = getContributorConfigurationError();
  if (configurationError) {
    throw new Error(configurationError);
  }
  await ensureConfigTables();
}

export function validateContributorPassword(password: string) {
  return validateAdminPassword(password);
}

export async function createContributorSessionToken(
  email: string,
  expiresAt = Date.now() + getContributorSessionTtlSeconds() * 1000,
) {
  const configurationError = getContributorConfigurationError();
  if (configurationError) {
    throw new Error(configurationError);
  }

  const user = await getContributorUserByEmail(email);
  if (!user) {
    throw new Error("Contributor account not found.");
  }

  const payload = encodePayload({
    email: normalizeContributorEmail(email),
    issuedAt: Date.now(),
    expiresAt,
    credentialsVersion: user.updatedAt,
  });

  return `${payload}.${signPayload(payload)}`;
}

export async function readContributorSessionToken(
  sessionToken: string | undefined | null,
): Promise<ContributorSessionReadResult> {
  const configurationError = getContributorConfigurationError();
  if (configurationError) {
    return {
      ok: false,
      status: 503,
      message: configurationError,
    };
  }

  if (!sessionToken) {
    return {
      ok: false,
      status: 401,
      message: "Sign in to edit.",
    };
  }

  const [payload, signature] = sessionToken.split(".");
  if (!payload || !signature) {
    return {
      ok: false,
      status: 401,
      message: "Sign in to edit.",
    };
  }

  const expectedSignature = Buffer.from(signPayload(payload));
  const receivedSignature = Buffer.from(signature);
  if (
    expectedSignature.length !== receivedSignature.length ||
    !timingSafeEqual(expectedSignature, receivedSignature)
  ) {
    return {
      ok: false,
      status: 401,
      message: "Sign in to edit.",
    };
  }

  try {
    const decoded = decodePayload(payload);
    if (
      typeof decoded.email !== "string" ||
      typeof decoded.issuedAt !== "number" ||
      typeof decoded.expiresAt !== "number" ||
      typeof decoded.credentialsVersion !== "string"
    ) {
      return {
        ok: false,
        status: 401,
        message: "Sign in to edit.",
      };
    }

    if (decoded.expiresAt <= Date.now()) {
      return {
        ok: false,
        status: 401,
        message: "Sign in to edit.",
      };
    }

    const normalizedEmail = normalizeContributorEmail(decoded.email);
    const user = await getContributorUserByEmail(normalizedEmail);
    if (!user || user.updatedAt !== decoded.credentialsVersion) {
      return {
        ok: false,
        status: 401,
        message: "Sign in to edit.",
      };
    }

    return {
      ok: true,
      payload: {
        email: normalizedEmail,
        issuedAt: decoded.issuedAt,
        expiresAt: decoded.expiresAt,
        credentialsVersion: decoded.credentialsVersion,
      },
    };
  } catch {
    return {
      ok: false,
      status: 401,
      message: "Sign in to edit.",
    };
  }
}

export function getContributorSessionCookieSettings() {
  return {
    httpOnly: true,
    maxAge: getContributorSessionTtlSeconds(),
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function getContributorUserByEmail(email: string) {
  await ensureContributorAuthStorage();
  const normalizedEmail = normalizeContributorEmail(email);
  const { rows } = await queryConfigDb<ContributorUserDbRow>(
    `SELECT id, email, password_hash, password_salt, created_at, updated_at
     FROM contributor_users
     WHERE lower(email) = $1
     LIMIT 1`,
    [normalizedEmail],
  );
  return rows[0] ? toContributorUserRecord(rows[0]) : null;
}

export function hashContributorPassword(password: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return {
    passwordHash: hash.toString("base64"),
    passwordSalt: salt.toString("base64"),
  };
}

export function verifyContributorPassword(password: string, record: Pick<ContributorUserRecord, "passwordHash" | "passwordSalt">) {
  const derived = scryptSync(password, Buffer.from(record.passwordSalt, "base64"), 64);
  return timingSafeEqual(derived, Buffer.from(record.passwordHash, "base64"));
}

export async function createContributorUser(email: string, password: string) {
  await ensureContributorAuthStorage();
  const normalizedEmail = normalizeContributorEmail(email);
  if (!isWsuEmail(normalizedEmail)) {
    throw new Error("Contributor email must be a @wsu.edu address.");
  }

  const passwordError = validateContributorPassword(password);
  if (passwordError) {
    throw new Error(passwordError);
  }

  const { passwordHash, passwordSalt } = hashContributorPassword(password);
  const { rows } = await queryConfigDb<ContributorUserDbRow>(
    `INSERT INTO contributor_users (email, password_hash, password_salt)
     VALUES ($1, $2, $3)
     RETURNING id, email, password_hash, password_salt, created_at, updated_at`,
    [normalizedEmail, passwordHash, passwordSalt],
  );

  return toContributorUserRecord(rows[0]!);
}

/** Throttle old-row cleanup so rate-limit checks stay mostly read-only. */
const CONTRIBUTOR_LOGIN_ATTEMPTS_DB_PRUNE_INTERVAL_MS = 5 * 60 * 1000;
let lastContributorLoginAttemptsDbPruneAt = 0;

export async function recordContributorFailedAttempt(rateLimitKey: string) {
  await ensureContributorAuthStorage();
  await queryConfigDb(
    `INSERT INTO contributor_login_attempts (ip, attempted_at)
     VALUES ($1, now())`,
    [rateLimitKey],
  );
  const now = Date.now();
  if (now - lastContributorLoginAttemptsDbPruneAt >= CONTRIBUTOR_LOGIN_ATTEMPTS_DB_PRUNE_INTERVAL_MS) {
    lastContributorLoginAttemptsDbPruneAt = now;
    await queryConfigDb(
      `DELETE FROM contributor_login_attempts
       WHERE attempted_at < now() - interval '1 day'`,
    );
  }
}

export async function pruneContributorFailedAttempts() {
  await ensureContributorAuthStorage();
  await queryConfigDb(
    `DELETE FROM contributor_login_attempts
     WHERE attempted_at < now() - interval '1 day'`,
  );
}

export async function getContributorRecentFailedAttemptCount(rateLimitKey: string) {
  await ensureContributorAuthStorage();
  const { rows } = await queryConfigDb<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM contributor_login_attempts
     WHERE ip = $1
       AND attempted_at > now() - make_interval(mins => $2)`,
    [rateLimitKey, CONTRIBUTOR_RATE_LIMIT_WINDOW_MINUTES],
  );
  return Number(rows[0]?.count ?? 0);
}

export async function isContributorRateLimited(rateLimitKey: string) {
  return (await getContributorRecentFailedAttemptCount(rateLimitKey)) >= CONTRIBUTOR_RATE_LIMIT_MAX_ATTEMPTS;
}

export function getContributorClientIp(requestHeaders: Headers) {
  return getTrustedClientIp(requestHeaders);
}

export const CONTRIBUTOR_RESET_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

interface ContributorResetTokenPayload {
  email: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
}

export async function createContributorResetToken(email: string): Promise<string> {
  await ensureContributorAuthStorage();
  const normalizedEmail = normalizeContributorEmail(email);
  const nonce = randomBytes(16).toString("hex");
  const expiresAt = Date.now() + CONTRIBUTOR_RESET_TOKEN_TTL_MS;
  await queryConfigDb(
    `UPDATE contributor_users SET reset_nonce = $1 WHERE lower(email) = $2`,
    [nonce, normalizedEmail],
  );
  const payload = Buffer.from(JSON.stringify({ email: normalizedEmail, nonce, issuedAt: Date.now(), expiresAt })).toString("base64url");
  return `${payload}.${signPayload(payload)}`;
}

export async function verifyContributorResetToken(token: string): Promise<string | null> {
  const configError = getContributorConfigurationError();
  if (configError) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expectedSig = Buffer.from(signPayload(payload));
  const receivedSig = Buffer.from(signature);
  if (expectedSig.length !== receivedSig.length || !timingSafeEqual(expectedSig, receivedSig)) return null;
  let decoded: Partial<ContributorResetTokenPayload>;
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<ContributorResetTokenPayload>;
  } catch {
    return null;
  }
  if (
    typeof decoded.email !== "string" ||
    typeof decoded.nonce !== "string" ||
    typeof decoded.expiresAt !== "number" ||
    decoded.expiresAt <= Date.now()
  ) return null;
  await ensureContributorAuthStorage();
  const { rows } = await queryConfigDb<{ reset_nonce: string | null }>(
    `SELECT reset_nonce FROM contributor_users WHERE lower(email) = $1 LIMIT 1`,
    [normalizeContributorEmail(decoded.email)],
  );
  const stored = rows[0]?.reset_nonce;
  if (!stored || stored !== decoded.nonce) return null;
  return normalizeContributorEmail(decoded.email);
}

export async function resetContributorPassword(email: string, newPassword: string): Promise<void> {
  await ensureContributorAuthStorage();
  const passwordError = validateContributorPassword(newPassword);
  if (passwordError) throw new Error(passwordError);
  const { passwordHash, passwordSalt } = hashContributorPassword(newPassword);
  await queryConfigDb(
    `UPDATE contributor_users SET password_hash = $1, password_salt = $2, reset_nonce = NULL, updated_at = now() WHERE lower(email) = $3`,
    [passwordHash, passwordSalt, normalizeContributorEmail(email)],
  );
}

export async function listContributorUsers() {
  await ensureContributorAuthStorage();
  const { rows } = await queryConfigDb<{ id: string; email: string; created_at: string | Date; updated_at: string | Date }>(
    `SELECT id, email, created_at, updated_at FROM contributor_users ORDER BY email`,
  );
  return rows.map((row) => ({
    id: row.id,
    email: normalizeContributorEmail(row.email),
    createdAt: toIsoTimestamp(row.created_at),
    updatedAt: toIsoTimestamp(row.updated_at),
  }));
}

export async function deleteContributorUser(id: string): Promise<void> {
  await ensureContributorAuthStorage();
  await queryConfigDb(`DELETE FROM contributor_users WHERE id = $1`, [id]);
}
