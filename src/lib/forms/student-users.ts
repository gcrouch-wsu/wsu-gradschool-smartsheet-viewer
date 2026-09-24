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
  if (
    !getStudentSessionSecret() &&
    !process.env.SMARTSHEETS_VIEW_ADMIN_SESSION_SECRET?.trim()
  ) {
    return `${STUDENT_SESSION_SECRET_ENV_VAR}, ${CONTRIBUTOR_SESSION_SECRET_ENV_VAR}, or SMARTSHEETS_VIEW_ADMIN_SESSION_SECRET is required for student sign-in.`;
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

  const { getPlatformUserByEmail } = await import("@/lib/platform-users");
  const user = await getPlatformUserByEmail(email);
  if (!user) {
    throw new Error("Student account not found.");
  }

  const { createPlatformUserSessionToken } = await import("@/lib/platform-session");
  return createPlatformUserSessionToken(
    { id: user.id, email: user.email, updatedAt: user.updatedAt },
    expiresAt,
  );
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
  const {
    getPlatformUserByEmail,
  } = await import("@/lib/platform-users");
  const platformUser = await getPlatformUserByEmail(normalizedEmail);
  if (platformUser?.roles.includes("student")) {
    return {
      id: platformUser.id,
      email: platformUser.email,
      passwordHash: platformUser.passwordHash,
      passwordSalt: platformUser.passwordSalt,
      createdAt: platformUser.createdAt,
      updatedAt: platformUser.updatedAt,
    } satisfies StudentUserRecord;
  }
  return null;
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

  const { createOrUpdateUserWithRole } = await import("@/lib/platform-users");
  try {
    const user = await createOrUpdateUserWithRole(normalizedEmail, password, "student");
    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      passwordSalt: user.passwordSalt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    } satisfies StudentUserRecord;
  } catch (error) {
    if (error instanceof Error && error.message === "ACCOUNT_EXISTS") {
      const err = new Error("ACCOUNT_EXISTS") as Error & { code?: string };
      err.code = "23505";
      throw err;
    }
    throw error;
  }
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
  const { getPlatformUserByEmail, createPlatformResetToken } = await import("@/lib/platform-users");
  const user = await getPlatformUserByEmail(normalizedEmail);
  if (!user?.roles.includes("student")) {
    throw new Error("Student account not found.");
  }
  return createPlatformResetToken(user.id);
}

export async function verifyStudentResetToken(token: string): Promise<string | null> {
  const configError = getStudentConfigurationError();
  if (configError) return null;
  // Platform reset tokens are consumed on password set; peek via parse for email.
  const [payloadPart] = token.split(".");
  if (!payloadPart) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")) as {
      email?: string;
      userId?: string;
      nonce?: string;
    };
    if (!parsed.email || !parsed.userId || !parsed.nonce) return null;
    const { getPlatformUserById } = await import("@/lib/platform-users");
    const user = await getPlatformUserById(parsed.userId);
    if (!user || user.resetNonce !== parsed.nonce) return null;
    return normalizeContributorEmail(parsed.email);
  } catch {
    return null;
  }
}

export async function resetStudentPassword(email: string, newPassword: string): Promise<void> {
  await ensureStudentAuthStorage();
  const passwordError = validateStudentPassword(newPassword);
  if (passwordError) throw new Error(passwordError);
  const { getPlatformUserByEmail, updatePlatformUserPassword } = await import("@/lib/platform-users");
  const user = await getPlatformUserByEmail(normalizeContributorEmail(email));
  if (!user) throw new Error("Student account not found.");
  await updatePlatformUserPassword(user.id, newPassword);
}

export async function listStudentUsers() {
  await ensureStudentAuthStorage();
  const { listPlatformUsers } = await import("@/lib/platform-users");
  const users = await listPlatformUsers({ role: "student" });
  return users.map((row) => ({
    id: row.id,
    email: normalizeContributorEmail(row.email),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export async function deleteStudentUser(id: string): Promise<void> {
  await ensureStudentAuthStorage();
  const { getPlatformUserById, setUserRoles, deletePlatformUser } = await import("@/lib/platform-users");
  const user = await getPlatformUserById(id);
  if (!user) return;
  const remaining = user.roles.filter((r) => r !== "student") as import("@/lib/platform-users").AssignablePlatformRole[];
  if (remaining.length === 0) {
    await deletePlatformUser(id);
  } else {
    await setUserRoles(id, remaining);
  }
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
  const existing = await getStudentUserByEmail(normalizedEmail);
  if (existing) return existing;

  const { ensureConfigTables, queryConfigDb } = await import("@/lib/config/config-db");
  await ensureConfigTables();
  const { rows } = await queryConfigDb<{ id: string }>(
    `INSERT INTO users (email, password_hash, password_salt, created_at, updated_at)
     VALUES ($1, $2, $3, COALESCE($4::timestamptz, now()), COALESCE($5::timestamptz, now()))
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [
      normalizedEmail,
      input.passwordHash,
      input.passwordSalt,
      input.createdAt ?? null,
      input.updatedAt ?? null,
    ],
  );
  const id = rows[0]?.id;
  if (id) {
    await queryConfigDb(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, 'student') ON CONFLICT DO NOTHING`, [
      id,
    ]);
  }
  return getStudentUserByEmail(normalizedEmail);
}
