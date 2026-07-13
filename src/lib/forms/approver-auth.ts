import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { validateAdminPassword } from "@/lib/admin-auth";
import { ensureFormsTables, isFormsDatabaseEnabled, queryFormsDb } from "@/lib/forms/db";
import { getTrustedClientIp } from "@/lib/request-ip";

export const FORM_APPROVER_SESSION_COOKIE_NAME = "smartsheets_view_form_approver_session";
export const FORM_APPROVER_SESSION_SECRET_ENV_VAR = "FORM_APPROVER_SESSION_SECRET";
export const FORM_APPROVER_SESSION_TTL_ENV_VAR = "FORM_APPROVER_SESSION_TTL_SECONDS";
export const FORM_APPROVER_DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 4;
export const FORM_APPROVER_RATE_LIMIT_MAX_ATTEMPTS = 5;
export const FORM_APPROVER_RATE_LIMIT_WINDOW_MINUTES = 15;
export const FORM_APPROVER_GENERIC_LOGIN_ERROR = "Invalid email or password.";
export const FORM_APPROVER_TOO_MANY_ATTEMPTS_ERROR = "Too many attempts. Try again later.";

export interface FormApproverSessionPayload {
  email: string;
  issuedAt: number;
  expiresAt: number;
  credentialsVersion: string;
}

export interface FormApproverSessionReadResult {
  ok: boolean;
  payload?: FormApproverSessionPayload;
  status?: number;
  message?: string;
}

interface FormApproverUserDbRow {
  id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface FormApproverUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
  updatedAt: string;
}

function normalizeApproverEmail(email: string) {
  return email.trim().toLowerCase();
}

function getApproverSessionSecret() {
  return process.env[FORM_APPROVER_SESSION_SECRET_ENV_VAR]?.trim() ?? "";
}

export function getApproverSessionTtlSeconds() {
  const raw = process.env[FORM_APPROVER_SESSION_TTL_ENV_VAR]?.trim();
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : FORM_APPROVER_DEFAULT_SESSION_TTL_SECONDS;
}

export function getFormApproverConfigurationError() {
  if (!isFormsDatabaseEnabled()) {
    return "Form approver accounts require DATABASE_URL.";
  }
  if (!getApproverSessionSecret()) {
    return `${FORM_APPROVER_SESSION_SECRET_ENV_VAR} is required for form approver sessions.`;
  }
  return null;
}

function encodePayload(payload: FormApproverSessionPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<FormApproverSessionPayload>;
}

function signPayload(payload: string) {
  return createHmac("sha256", getApproverSessionSecret()).update(payload).digest("base64url");
}

function toIsoTimestamp(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toApproverUserRecord(row: FormApproverUserDbRow): FormApproverUserRecord {
  return {
    id: row.id,
    email: normalizeApproverEmail(row.email),
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    createdAt: toIsoTimestamp(row.created_at),
    updatedAt: toIsoTimestamp(row.updated_at),
  };
}

async function ensureApproverAuthStorage() {
  const configurationError = getFormApproverConfigurationError();
  if (configurationError) throw new Error(configurationError);
  await ensureFormsTables();
}

export function validateFormApproverPassword(password: string) {
  return validateAdminPassword(password);
}

export async function createFormApproverSessionToken(
  email: string,
  expiresAt = Date.now() + getApproverSessionTtlSeconds() * 1000,
) {
  await ensureApproverAuthStorage();
  const user = await getFormApproverUserByEmail(email);
  if (!user) throw new Error("Approver account not found.");

  const payload = encodePayload({
    email: normalizeApproverEmail(email),
    issuedAt: Date.now(),
    expiresAt,
    credentialsVersion: user.updatedAt,
  });
  return `${payload}.${signPayload(payload)}`;
}

export async function readFormApproverSessionToken(
  sessionToken: string | undefined | null,
): Promise<FormApproverSessionReadResult> {
  const configurationError = getFormApproverConfigurationError();
  if (configurationError) {
    return { ok: false, status: 503, message: configurationError };
  }

  if (!sessionToken) {
    return { ok: false, status: 401, message: "Sign in required." };
  }

  const [payload, signature] = sessionToken.split(".");
  if (!payload || !signature) {
    return { ok: false, status: 401, message: "Sign in required." };
  }

  const expectedSignature = Buffer.from(signPayload(payload));
  const receivedSignature = Buffer.from(signature);
  if (
    expectedSignature.length !== receivedSignature.length ||
    !timingSafeEqual(expectedSignature, receivedSignature)
  ) {
    return { ok: false, status: 401, message: "Sign in required." };
  }

  try {
    const decoded = decodePayload(payload);
    if (
      typeof decoded.email !== "string" ||
      typeof decoded.issuedAt !== "number" ||
      typeof decoded.expiresAt !== "number" ||
      typeof decoded.credentialsVersion !== "string"
    ) {
      return { ok: false, status: 401, message: "Sign in required." };
    }

    if (decoded.expiresAt <= Date.now()) {
      return { ok: false, status: 401, message: "Sign in required." };
    }

    const normalizedEmail = normalizeApproverEmail(decoded.email);
    const user = await getFormApproverUserByEmail(normalizedEmail);
    if (!user || user.updatedAt !== decoded.credentialsVersion) {
      return { ok: false, status: 401, message: "Sign in required." };
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
    return { ok: false, status: 401, message: "Sign in required." };
  }
}

export function getFormApproverSessionCookieSettings() {
  return {
    httpOnly: true,
    maxAge: getApproverSessionTtlSeconds(),
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function getFormApproverUserByEmail(email: string) {
  await ensureApproverAuthStorage();
  const normalizedEmail = normalizeApproverEmail(email);
  const { rows } = await queryFormsDb<FormApproverUserDbRow>(
    `SELECT id, email, password_hash, password_salt, created_at, updated_at
     FROM form_approver_users
     WHERE lower(email) = $1
     LIMIT 1`,
    [normalizedEmail],
  );
  return rows[0] ? toApproverUserRecord(rows[0]) : null;
}

export function hashFormApproverPassword(password: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return {
    passwordHash: hash.toString("base64"),
    passwordSalt: salt.toString("base64"),
  };
}

export function verifyFormApproverPassword(
  password: string,
  record: Pick<FormApproverUserRecord, "passwordHash" | "passwordSalt">,
) {
  const salt = Buffer.from(record.passwordSalt, "base64");
  const hash = scryptSync(password, salt, 64);
  const expected = Buffer.from(record.passwordHash, "base64");
  return expected.length === hash.length && timingSafeEqual(expected, hash);
}

export async function recordFormApproverLoginAttempt(ip: string) {
  await ensureApproverAuthStorage();
  await queryFormsDb(
    `INSERT INTO form_approver_login_attempts (ip, attempted_at) VALUES ($1, now())`,
    [ip],
  );
  await queryFormsDb(
    `DELETE FROM form_approver_login_attempts
     WHERE attempted_at < now() - interval '${FORM_APPROVER_RATE_LIMIT_WINDOW_MINUTES} minutes'`,
  );
}

export async function countRecentFormApproverLoginAttempts(ip: string) {
  await ensureApproverAuthStorage();
  const { rows } = await queryFormsDb<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM form_approver_login_attempts
     WHERE ip = $1 AND attempted_at > now() - interval '${FORM_APPROVER_RATE_LIMIT_WINDOW_MINUTES} minutes'`,
    [ip],
  );
  return Number(rows[0]?.count ?? 0);
}

export async function authenticateFormApprover(email: string, password: string, requestIp: string) {
  const ip = requestIp || "local";
  const attempts = await countRecentFormApproverLoginAttempts(ip);
  if (attempts >= FORM_APPROVER_RATE_LIMIT_MAX_ATTEMPTS) {
    return { ok: false as const, message: FORM_APPROVER_TOO_MANY_ATTEMPTS_ERROR, status: 429 };
  }

  const user = await getFormApproverUserByEmail(email);
  if (!user || !verifyFormApproverPassword(password, user)) {
    await recordFormApproverLoginAttempt(ip);
    return { ok: false as const, message: FORM_APPROVER_GENERIC_LOGIN_ERROR, status: 401 };
  }

  const token = await createFormApproverSessionToken(user.email);
  return { ok: true as const, token, email: user.email };
}

export async function readFormApproverSessionFromRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`${FORM_APPROVER_SESSION_COOKIE_NAME}=([^;]+)`));
  return readFormApproverSessionToken(match?.[1] ? decodeURIComponent(match[1]) : null);
}

export function getTrustedIpFromRequest(request: Request) {
  return getTrustedClientIp(request.headers);
}
