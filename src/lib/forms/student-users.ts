/**
 * Student portal accounts and sessions — separate from contributor_users / contributor cookie.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { ensureConfigTables, isDatabaseConfigEnabled, queryConfigDb } from "@/lib/config/config-db";
import {
  CONTRIBUTOR_SESSION_SECRET_ENV_VAR,
  hashContributorPassword,
  validateContributorPassword,
  verifyContributorPassword,
} from "@/lib/contributor-auth";
import { isWsuEmail, normalizeContributorEmail } from "@/lib/contributor-utils";

export const STUDENT_SESSION_COOKIE_NAME = "smartsheets_view_student_session";
export const STUDENT_SESSION_SECRET_ENV_VAR = "STUDENT_SESSION_SECRET";
export const STUDENT_SESSION_TTL_ENV_VAR = "STUDENT_SESSION_TTL_SECONDS";
export const STUDENT_DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 4;

export const STUDENT_GENERIC_LOGIN_ERROR = "Invalid email or password.";
export const STUDENT_GENERIC_CLAIM_ERROR =
  "Unable to set password. Use sign in if you already have access or contact your coordinator.";
export const STUDENT_CLAIM_ACCOUNT_EXISTS_ERROR =
  "An account already exists for this email. Go back and continue again to sign in with your password.";
export const STUDENT_CLAIM_NOT_ELIGIBLE_ERROR =
  "We could not verify this email as a Student Email on an available sheet. Use your @wsu.edu address from the sheet, or contact your coordinator.";

export interface StudentSessionPayload {
  email: string;
  issuedAt: number;
  expiresAt: number;
  credentialsVersion: string;
}

export interface StudentSessionReadResult {
  ok: boolean;
  payload?: StudentSessionPayload;
  status?: number;
  message?: string;
}

interface StudentUserDbRow {
  id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface StudentUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
  updatedAt: string;
}

function getStudentSessionSecret() {
  return (
    process.env[STUDENT_SESSION_SECRET_ENV_VAR]?.trim() ||
    process.env[CONTRIBUTOR_SESSION_SECRET_ENV_VAR]?.trim() ||
    ""
  );
}

export function getStudentSessionTtlSeconds() {
  const raw = process.env[STUDENT_SESSION_TTL_ENV_VAR]?.trim();
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : STUDENT_DEFAULT_SESSION_TTL_SECONDS;
}

export function getStudentConfigurationError() {
  if (!isDatabaseConfigEnabled()) {
    return "Student sign-in requires DATABASE_URL.";
  }
  if (!getStudentSessionSecret()) {
    return `${STUDENT_SESSION_SECRET_ENV_VAR} or ${CONTRIBUTOR_SESSION_SECRET_ENV_VAR} is required for student sign-in.`;
  }
  return null;
}

function encodePayload(payload: StudentSessionPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<StudentSessionPayload>;
}

function signPayload(payload: string) {
  return createHmac("sha256", getStudentSessionSecret()).update(payload).digest("base64url");
}

function toIsoTimestamp(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toStudentUserRecord(row: StudentUserDbRow): StudentUserRecord {
  return {
    id: row.id,
    email: normalizeContributorEmail(row.email),
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    createdAt: toIsoTimestamp(row.created_at),
    updatedAt: toIsoTimestamp(row.updated_at),
  };
}

let studentAuthStorageReady = false;
let studentAuthStoragePromise: Promise<void> | null = null;
/** Avoid deadlock when migration inserts rows via helpers that call ensureStudentAuthStorage. */
let studentAuthStorageSkipMigration = false;

async function ensureStudentAuthStorage(options?: { skipMigration?: boolean }) {
  const configurationError = getStudentConfigurationError();
  if (configurationError) {
    throw new Error(configurationError);
  }

  if (options?.skipMigration || studentAuthStorageSkipMigration) {
    await ensureConfigTables();
    return;
  }

  if (studentAuthStorageReady) return;

  if (!studentAuthStoragePromise) {
    studentAuthStoragePromise = (async () => {
      await ensureConfigTables();
      studentAuthStorageSkipMigration = true;
      try {
        const { ensureStudentAccountsMigrated } = await import("@/lib/forms/migrate-student-accounts");
        await ensureStudentAccountsMigrated();
      } finally {
        studentAuthStorageSkipMigration = false;
      }
      studentAuthStorageReady = true;
    })().catch((error) => {
      studentAuthStoragePromise = null;
      throw error;
    });
  }

  await studentAuthStoragePromise;
}

export function validateStudentPassword(password: string) {
  return validateContributorPassword(password);
}

export function hashStudentPassword(password: string) {
  return hashContributorPassword(password);
}

export function verifyStudentPassword(
  password: string,
  record: Pick<StudentUserRecord, "passwordHash" | "passwordSalt">,
) {
  return verifyContributorPassword(password, record);
}

export async function createStudentSessionToken(
  email: string,
  expiresAt = Date.now() + getStudentSessionTtlSeconds() * 1000,
) {
  const configurationError = getStudentConfigurationError();
  if (configurationError) {
    throw new Error(configurationError);
  }

  const user = await getStudentUserByEmail(email);
  if (!user) {
    throw new Error("Student account not found.");
  }

  const payload = encodePayload({
    email: normalizeContributorEmail(email),
    issuedAt: Date.now(),
    expiresAt,
    credentialsVersion: user.updatedAt,
  });

  return `${payload}.${signPayload(payload)}`;
}

export async function readStudentSessionToken(
  sessionToken: string | undefined | null,
): Promise<StudentSessionReadResult> {
  const configurationError = getStudentConfigurationError();
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

    const normalizedEmail = normalizeContributorEmail(decoded.email);
    const user = await getStudentUserByEmail(normalizedEmail);
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

export function getStudentSessionCookieSettings() {
  return {
    httpOnly: true,
    maxAge: getStudentSessionTtlSeconds(),
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function getStudentUserByEmail(email: string) {
  await ensureStudentAuthStorage();
  const normalizedEmail = normalizeContributorEmail(email);
  const { rows } = await queryConfigDb<StudentUserDbRow>(
    `SELECT id, email, password_hash, password_salt, created_at, updated_at
     FROM student_users
     WHERE lower(email) = $1
     LIMIT 1`,
    [normalizedEmail],
  );
  return rows[0] ? toStudentUserRecord(rows[0]) : null;
}

export async function createStudentUser(email: string, password: string) {
  await ensureStudentAuthStorage();
  const normalizedEmail = normalizeContributorEmail(email);
  if (!isWsuEmail(normalizedEmail)) {
    throw new Error("Student email must be a @wsu.edu address.");
  }

  const passwordError = validateStudentPassword(password);
  if (passwordError) {
    throw new Error(passwordError);
  }

  const { passwordHash, passwordSalt } = hashStudentPassword(password);
  const { rows } = await queryConfigDb<StudentUserDbRow>(
    `INSERT INTO student_users (email, password_hash, password_salt)
     VALUES ($1, $2, $3)
     RETURNING id, email, password_hash, password_salt, created_at, updated_at`,
    [normalizedEmail, passwordHash, passwordSalt],
  );

  return toStudentUserRecord(rows[0]!);
}

export const STUDENT_RESET_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

interface StudentResetTokenPayload {
  email: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
}

export async function createStudentResetToken(email: string): Promise<string> {
  await ensureStudentAuthStorage();
  const normalizedEmail = normalizeContributorEmail(email);
  const nonce = randomBytes(16).toString("hex");
  const expiresAt = Date.now() + STUDENT_RESET_TOKEN_TTL_MS;
  await queryConfigDb(`UPDATE student_users SET reset_nonce = $1 WHERE lower(email) = $2`, [
    nonce,
    normalizedEmail,
  ]);
  const payload = Buffer.from(
    JSON.stringify({ email: normalizedEmail, nonce, issuedAt: Date.now(), expiresAt }),
  ).toString("base64url");
  return `${payload}.${signPayload(payload)}`;
}

export async function verifyStudentResetToken(token: string): Promise<string | null> {
  const configError = getStudentConfigurationError();
  if (configError) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expectedSig = Buffer.from(signPayload(payload));
  const receivedSig = Buffer.from(signature);
  if (expectedSig.length !== receivedSig.length || !timingSafeEqual(expectedSig, receivedSig)) {
    return null;
  }
  let decoded: Partial<StudentResetTokenPayload>;
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<StudentResetTokenPayload>;
  } catch {
    return null;
  }
  if (
    typeof decoded.email !== "string" ||
    typeof decoded.nonce !== "string" ||
    typeof decoded.expiresAt !== "number" ||
    decoded.expiresAt <= Date.now()
  ) {
    return null;
  }
  await ensureStudentAuthStorage();
  const { rows } = await queryConfigDb<{ reset_nonce: string | null }>(
    `SELECT reset_nonce FROM student_users WHERE lower(email) = $1 LIMIT 1`,
    [normalizeContributorEmail(decoded.email)],
  );
  const stored = rows[0]?.reset_nonce;
  if (!stored || stored !== decoded.nonce) return null;
  return normalizeContributorEmail(decoded.email);
}

export async function resetStudentPassword(email: string, newPassword: string): Promise<void> {
  await ensureStudentAuthStorage();
  const passwordError = validateStudentPassword(newPassword);
  if (passwordError) throw new Error(passwordError);
  const { passwordHash, passwordSalt } = hashStudentPassword(newPassword);
  await queryConfigDb(
    `UPDATE student_users SET password_hash = $1, password_salt = $2, reset_nonce = NULL, updated_at = now() WHERE lower(email) = $3`,
    [passwordHash, passwordSalt, normalizeContributorEmail(email)],
  );
}

export async function listStudentUsers() {
  await ensureStudentAuthStorage();
  const { rows } = await queryConfigDb<{
    id: string;
    email: string;
    created_at: string | Date;
    updated_at: string | Date;
  }>(`SELECT id, email, created_at, updated_at FROM student_users ORDER BY email`);
  return rows.map((row) => ({
    id: row.id,
    email: normalizeContributorEmail(row.email),
    createdAt: toIsoTimestamp(row.created_at),
    updatedAt: toIsoTimestamp(row.updated_at),
  }));
}

export async function deleteStudentUser(id: string): Promise<void> {
  await ensureStudentAuthStorage();
  await queryConfigDb(`DELETE FROM student_users WHERE id = $1`, [id]);
}

export async function insertStudentUserFromHashes(input: {
  email: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt?: string;
  updatedAt?: string;
}): Promise<StudentUserRecord | null> {
  await ensureStudentAuthStorage({ skipMigration: true });
  const normalizedEmail = normalizeContributorEmail(input.email);
  const existing = await getStudentUserByEmailSkippingEnsure(normalizedEmail);
  if (existing) return existing;

  const { rows } = await queryConfigDb<StudentUserDbRow>(
    `INSERT INTO student_users (email, password_hash, password_salt, created_at, updated_at)
     VALUES ($1, $2, $3, COALESCE($4::timestamptz, now()), COALESCE($5::timestamptz, now()))
     ON CONFLICT (email) DO NOTHING
     RETURNING id, email, password_hash, password_salt, created_at, updated_at`,
    [
      normalizedEmail,
      input.passwordHash,
      input.passwordSalt,
      input.createdAt ?? null,
      input.updatedAt ?? null,
    ],
  );
  return rows[0] ? toStudentUserRecord(rows[0]) : getStudentUserByEmailSkippingEnsure(normalizedEmail);
}

async function getStudentUserByEmailSkippingEnsure(email: string) {
  const normalizedEmail = normalizeContributorEmail(email);
  const { rows } = await queryConfigDb<StudentUserDbRow>(
    `SELECT id, email, password_hash, password_salt, created_at, updated_at
     FROM student_users
     WHERE lower(email) = $1
     LIMIT 1`,
    [normalizedEmail],
  );
  return rows[0] ? toStudentUserRecord(rows[0]) : null;
}
