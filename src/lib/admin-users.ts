import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { Pool } from "pg";
import { cookies } from "next/headers";
import { buildPgPoolOptions } from "@/lib/pg-connection";
import { NextResponse } from "next/server";
import {
  ADMIN_PASSWORD_ENV_VAR,
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_SECRET_ENV_VAR,
  ADMIN_USERNAME_ENV_VAR,
  type AdminRole,
  type AdminUserSource,
  createAdminSessionToken,
  getAdminConfigurationError,
  readAdminSessionToken,
  validateAdminPassword,
} from "@/lib/admin-auth";

const ADMIN_USERS_DIR = path.join(process.cwd(), "config", "admin-users");
const DATABASE_URL_ENV_VAR = "DATABASE_URL";
const BOOTSTRAP_ADMIN_ID = "bootstrap-env-admin";
const BOOTSTRAP_ADMIN_LABEL = "Bootstrap Owner";
const USERNAME_PATTERN = /^[a-z0-9._@-]+$/;
const globalForDb = globalThis as typeof globalThis & {
  __smartsheetsViewAdminPool?: Pool;
};

/** Same window as contributor login rate limit. */
export const ADMIN_LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5;
export const ADMIN_LOGIN_RATE_LIMIT_WINDOW_MINUTES = 15;
export const ADMIN_LOGIN_TOO_MANY_ATTEMPTS_ERROR = "Too many sign-in attempts. Try again later.";

const adminLoginAttemptsMemory = new Map<string, number[]>();

/** Throttle old-row cleanup so rate-limit checks stay mostly read-only. */
const ADMIN_LOGIN_ATTEMPTS_DB_PRUNE_INTERVAL_MS = 5 * 60 * 1000;
let lastAdminLoginAttemptsDbPruneAt = 0;

function pruneAdminAttemptsMemory(now: number) {
  const windowMs = ADMIN_LOGIN_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;
  for (const [ip, times] of adminLoginAttemptsMemory) {
    const next = times.filter((t) => now - t < windowMs);
    if (next.length === 0) {
      adminLoginAttemptsMemory.delete(ip);
    } else {
      adminLoginAttemptsMemory.set(ip, next);
    }
  }
}

export async function recordAdminFailedLoginAttempt(rateLimitKey: string): Promise<void> {
  if (!getDatabaseUrl()) {
    const now = Date.now();
    pruneAdminAttemptsMemory(now);
    const times = adminLoginAttemptsMemory.get(rateLimitKey) ?? [];
    times.push(now);
    adminLoginAttemptsMemory.set(rateLimitKey, times);
    return;
  }

  await ensureManagedAdminsTable();
  await query(
    `INSERT INTO admin_login_attempts (ip, attempted_at) VALUES ($1, now())`,
    [rateLimitKey],
  );
  const now = Date.now();
  if (now - lastAdminLoginAttemptsDbPruneAt >= ADMIN_LOGIN_ATTEMPTS_DB_PRUNE_INTERVAL_MS) {
    lastAdminLoginAttemptsDbPruneAt = now;
    await query(`DELETE FROM admin_login_attempts WHERE attempted_at < now() - interval '1 day'`);
  }
}

export async function isAdminLoginRateLimited(rateLimitKey: string): Promise<boolean> {
  // In-memory attempts are per serverless instance / process; without DATABASE_URL, limits reset on cold start.
  if (!getDatabaseUrl()) {
    const now = Date.now();
    pruneAdminAttemptsMemory(now);
    const times = adminLoginAttemptsMemory.get(rateLimitKey) ?? [];
    const windowMs = ADMIN_LOGIN_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;
    const recent = times.filter((t) => now - t < windowMs);
    return recent.length >= ADMIN_LOGIN_RATE_LIMIT_MAX_ATTEMPTS;
  }

  await ensureManagedAdminsTable();
  const { rows } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM admin_login_attempts
     WHERE ip = $1
       AND attempted_at > now() - make_interval(mins => $2)`,
    [rateLimitKey, ADMIN_LOGIN_RATE_LIMIT_WINDOW_MINUTES],
  );
  return Number(rows[0]?.count ?? 0) >= ADMIN_LOGIN_RATE_LIMIT_MAX_ATTEMPTS;
}

let ensureManagedAdminsTablePromise: Promise<void> | null = null;

export type ManagedAdminStorageMode = "database" | "file";

export interface AdminPrincipal {
  id: string;
  username: string;
  displayName?: string;
  role: AdminRole;
  source: AdminUserSource;
  version: string;
}

interface ManagedAdminUserRecord {
  id: string;
  username: string;
  displayName?: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  resetNonce?: string | null;
}

interface ManagedAdminUserDbRow {
  id: string;
  username: string;
  display_name?: string | null;
  password_hash: string;
  password_salt: string;
  created_at: string | Date;
  updated_at: string | Date;
  is_active: boolean;
  reset_nonce?: string | null;
}

export interface ManagedAdminUserSummary {
  id: string;
  username: string;
  displayName?: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  hasPassword: boolean;
  role: "admin";
  source: "managed";
}

export type AdminAccessMode = "claim" | "sign_in";

export interface AdminAccessStatusResult {
  ok: boolean;
  mode?: AdminAccessMode;
  status?: number;
  message?: string;
}

export interface AdminAccountSummary {
  id: string;
  username: string;
  displayName?: string;
  createdAt?: string;
  updatedAt?: string;
  isActive: boolean;
  role: AdminRole;
  source: AdminUserSource;
}

export interface AdminAuthResult {
  ok: boolean;
  principal?: AdminPrincipal;
  status?: number;
  message?: string;
}

export interface ManagedAdminUserInput {
  username: string;
  displayName?: string;
  password?: string;
  isActive?: boolean;
}

export class AdminAuthenticationError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AdminAuthenticationError";
    this.status = status;
  }
}

export class AdminUserActionError extends Error {
  status: number;
  errors?: string[];

  constructor(options: { status: number; message: string; errors?: string[] }) {
    super(options.message);
    this.name = "AdminUserActionError";
    this.status = options.status;
    this.errors = options.errors;
  }
}

function stripBom(value: string) {
  return value.replace(/^\uFEFF/, "");
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function sanitizeDisplayName(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function buildAdminUserId(username: string, existingIds: Set<string>) {
  const base = normalizeUsername(username)
    .replace(/@/g, "-at-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "admin-user";

  let candidate = base;
  let suffix = 2;
  while (existingIds.has(candidate) || candidate === BOOTSTRAP_ADMIN_ID) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

const MAX_MANAGED_ADMIN_FILE_STEM_LEN = 120;
const SAFE_MANAGED_ADMIN_FILE_STEM = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

function assertSafeManagedAdminUserId(id: string) {
  if (!id) {
    throw new Error("Managed admin id is required.");
  }
  if (id.length > MAX_MANAGED_ADMIN_FILE_STEM_LEN) {
    throw new Error(`Managed admin id is too long (max ${MAX_MANAGED_ADMIN_FILE_STEM_LEN} characters).`);
  }
  if (!SAFE_MANAGED_ADMIN_FILE_STEM.test(id)) {
    throw new Error("Managed admin id may only contain letters, numbers, hyphens, and underscores.");
  }
}

function adminUserFilePath(id: string) {
  assertSafeManagedAdminUserId(id);
  return path.join(ADMIN_USERS_DIR, `${id}.json`);
}

function getDatabaseUrl() {
  const value = process.env[DATABASE_URL_ENV_VAR]?.trim();
  return value ? value : null;
}

export function getManagedAdminStorageMode(): ManagedAdminStorageMode {
  return getDatabaseUrl() ? "database" : "file";
}

function getDatabasePool() {
  const rawUrl = getDatabaseUrl();
  if (!rawUrl) {
    throw new Error(`${DATABASE_URL_ENV_VAR} is not set.`);
  }

  if (!globalForDb.__smartsheetsViewAdminPool) {
    const { connectionString, ssl } = buildPgPoolOptions(rawUrl);
    globalForDb.__smartsheetsViewAdminPool = new Pool({
      connectionString,
      max: 2,
      connectionTimeoutMillis: 10_000,
      ...(ssl ? { ssl } : {}),
    });
  }

  return globalForDb.__smartsheetsViewAdminPool;
}

async function query<T = unknown>(text: string, params?: readonly unknown[]) {
  const pool = getDatabasePool();
  const result = await pool.query(text, params as unknown[]);
  return {
    rows: result.rows as T[],
    rowCount: result.rowCount ?? 0,
  };
}

function toIsoTimestamp(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toManagedRecordFromDatabaseRow(row: ManagedAdminUserDbRow): ManagedAdminUserRecord {
  return {
    id: row.id,
    username: normalizeUsername(row.username),
    displayName: sanitizeDisplayName(row.display_name ?? undefined),
    passwordHash: row.password_hash ?? "",
    passwordSalt: row.password_salt ?? "",
    createdAt: toIsoTimestamp(row.created_at),
    updatedAt: toIsoTimestamp(row.updated_at),
    isActive: Boolean(row.is_active),
    resetNonce: row.reset_nonce ?? null,
  };
}

function hasPassword(record: Pick<ManagedAdminUserRecord, "passwordHash" | "passwordSalt">) {
  return Boolean(record.passwordHash && record.passwordSalt);
}

async function ensureAdminUsersDir() {
  await mkdir(ADMIN_USERS_DIR, { recursive: true });
}

function validateManagedRecord(value: unknown, fileName: string): ManagedAdminUserRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid admin user record in ${fileName}: record must be an object.`);
  }

  const record = value as Record<string, unknown>;
  const username = normalizeUsername(typeof record.username === "string" ? record.username : "");
  const displayName = sanitizeDisplayName(typeof record.displayName === "string" ? record.displayName : undefined);
  const passwordHash = typeof record.passwordHash === "string" ? record.passwordHash : "";
  const passwordSalt = typeof record.passwordSalt === "string" ? record.passwordSalt : "";
  const createdAt = typeof record.createdAt === "string" ? record.createdAt : "";
  const updatedAt = typeof record.updatedAt === "string" ? record.updatedAt : "";
  const isActive = record.isActive === undefined ? true : Boolean(record.isActive);
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const resetNonce = typeof record.resetNonce === "string" ? record.resetNonce : null;

  if (!id) {
    throw new Error(`Invalid admin user record in ${fileName}: id is required.`);
  }
  if (!username || !USERNAME_PATTERN.test(username)) {
    throw new Error(`Invalid admin user record in ${fileName}: username is invalid.`);
  }
  if ((passwordHash && !passwordSalt) || (!passwordHash && passwordSalt)) {
    throw new Error(`Invalid admin user record in ${fileName}: passwordHash and passwordSalt must both be set or both empty.`);
  }
  if (!createdAt || !updatedAt) {
    throw new Error(`Invalid admin user record in ${fileName}: createdAt and updatedAt are required.`);
  }

  return {
    id,
    username,
    displayName,
    passwordHash,
    passwordSalt,
    createdAt,
    updatedAt,
    isActive,
    resetNonce,
  };
}

async function listManagedAdminUserRecordsFromFiles() {
  const entries = await readdir(ADMIN_USERS_DIR, { withFileTypes: true }).catch(() => []);
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();

  const records = await Promise.all(
    files.map(async (fileName) => {
      const raw = await readFile(path.join(ADMIN_USERS_DIR, fileName), "utf8");
      return validateManagedRecord(JSON.parse(stripBom(raw)) as unknown, fileName);
    }),
  );

  return records.sort((left, right) => {
    const leftLabel = left.displayName ?? left.username;
    const rightLabel = right.displayName ?? right.username;
    return leftLabel.localeCompare(rightLabel);
  });
}

async function getManagedAdminUserRecordByIdFromFiles(id: string) {
  const records = await listManagedAdminUserRecordsFromFiles();
  return records.find((record) => record.id === id) ?? null;
}

async function getManagedAdminUserRecordByUsernameFromFiles(username: string) {
  const normalized = normalizeUsername(username);
  const records = await listManagedAdminUserRecordsFromFiles();
  return records.find((record) => record.username === normalized) ?? null;
}

async function ensureManagedAdminsTable() {
  if (!getDatabaseUrl()) {
    return;
  }

  if (!ensureManagedAdminsTablePromise) {
    ensureManagedAdminsTablePromise = (async () => {
      const { runDatabaseMigrations } = await import("@/lib/db-migrations");
      await runDatabaseMigrations();
      await migrateFileManagedAdminsToDatabaseIfNeeded();
    })().catch((error) => {
      ensureManagedAdminsTablePromise = null;
      throw error;
    });
  }

  await ensureManagedAdminsTablePromise;
}

const POSTGRES_UNIQUE_VIOLATION = "23505";
const POSTGRES_USERNAME_CONSTRAINT = "admin_users_username_key";
const POSTGRES_PRIMARY_KEY_SUFFIX = "_pkey";

type PostgresUniqueViolationKind = "username" | "id" | "unknown";

function isPostgresUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION
  );
}

function getPostgresUniqueViolationKind(error: unknown): PostgresUniqueViolationKind | null {
  if (!isPostgresUniqueViolation(error)) {
    return null;
  }

  const constraint = typeof (error as { constraint?: unknown }).constraint === "string"
    ? (error as { constraint: string }).constraint
    : "";
  if (constraint === POSTGRES_USERNAME_CONSTRAINT) {
    return "username";
  }
  if (constraint.endsWith(POSTGRES_PRIMARY_KEY_SUFFIX)) {
    return "id";
  }

  const detail = typeof (error as { detail?: unknown }).detail === "string"
    ? (error as { detail: string }).detail
    : "";
  if (detail.includes("(username)=")) {
    return "username";
  }
  if (detail.includes("(id)=")) {
    return "id";
  }

  return "unknown";
}

async function migrateFileManagedAdminsToDatabaseIfNeeded() {
  const { rows } = await query<{ count: number }>("SELECT COUNT(*)::int AS count FROM admin_users");
  const count = Number(rows[0]?.count ?? 0);
  if (count > 0) {
    return;
  }

  const fileRecords = await listManagedAdminUserRecordsFromFiles();
  if (fileRecords.length === 0) {
    return;
  }

  const seenUsernames = new Set<string>();
  for (const record of fileRecords) {
    const normalized = normalizeUsername(record.username);
    if (seenUsernames.has(normalized)) {
      continue;
    }
    seenUsernames.add(normalized);

    try {
      await query(
        `
          INSERT INTO admin_users (
            id,
            username,
            display_name,
            password_hash,
            password_salt,
            created_at,
            updated_at,
            is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO NOTHING
        `,
        [
          record.id,
          record.username,
          record.displayName ?? null,
          record.passwordHash,
          record.passwordSalt,
          record.createdAt,
          record.updatedAt,
          record.isActive,
        ],
      );
    } catch (error) {
      if (isPostgresUniqueViolation(error)) {
        continue;
      }
      throw error;
    }
  }
}

async function listManagedAdminUserRecordsFromDatabase() {
  await ensureManagedAdminsTable();
  const { rows } = await query<ManagedAdminUserDbRow>(`
    SELECT id, username, display_name, password_hash, password_salt, created_at, updated_at, is_active, reset_nonce
    FROM admin_users
    ORDER BY COALESCE(display_name, username), username
  `);
  return rows.map(toManagedRecordFromDatabaseRow);
}

async function getManagedAdminUserRecordByIdFromDatabase(id: string) {
  await ensureManagedAdminsTable();
  const { rows } = await query<ManagedAdminUserDbRow>(`
    SELECT id, username, display_name, password_hash, password_salt, created_at, updated_at, is_active, reset_nonce
    FROM admin_users
    WHERE id = $1
  `, [id]);
  return rows[0] ? toManagedRecordFromDatabaseRow(rows[0]) : null;
}

async function getManagedAdminUserRecordByUsernameFromDatabase(username: string) {
  await ensureManagedAdminsTable();
  const { rows } = await query<ManagedAdminUserDbRow>(`
    SELECT id, username, display_name, password_hash, password_salt, created_at, updated_at, is_active, reset_nonce
    FROM admin_users
    WHERE username = $1
  `, [normalizeUsername(username)]);
  return rows[0] ? toManagedRecordFromDatabaseRow(rows[0]) : null;
}

async function listManagedAdminUserRecords() {
  return getManagedAdminStorageMode() === "database"
    ? listManagedAdminUserRecordsFromDatabase()
    : listManagedAdminUserRecordsFromFiles();
}

async function getManagedAdminUserRecordById(id: string) {
  return getManagedAdminStorageMode() === "database"
    ? getManagedAdminUserRecordByIdFromDatabase(id)
    : getManagedAdminUserRecordByIdFromFiles(id);
}

async function getManagedAdminUserRecordByUsername(username: string) {
  return getManagedAdminStorageMode() === "database"
    ? getManagedAdminUserRecordByUsernameFromDatabase(username)
    : getManagedAdminUserRecordByUsernameFromFiles(username);
}

function toManagedSummary(record: ManagedAdminUserRecord): ManagedAdminUserSummary {
  return {
    id: record.id,
    username: record.username,
    displayName: record.displayName,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    isActive: record.isActive,
    hasPassword: hasPassword(record),
    role: "admin",
    source: "managed",
  };
}

function toManagedPrincipal(record: ManagedAdminUserRecord): AdminPrincipal {
  return {
    id: record.id,
    username: record.username,
    displayName: record.displayName,
    role: "admin",
    source: "managed",
    version: record.updatedAt,
  };
}

function constantTimeEqualString(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  const maxLength = Math.max(leftBuffer.length, rightBuffer.length);
  let mismatch = leftBuffer.length === rightBuffer.length ? 0 : 1;

  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (leftBuffer[index] ?? 0) ^ (rightBuffer[index] ?? 0);
  }

  return mismatch === 0;
}
function getBootstrapCredentials() {
  const username = process.env[ADMIN_USERNAME_ENV_VAR]?.trim();
  const password = process.env[ADMIN_PASSWORD_ENV_VAR] ?? "";

  if (!username || !password) {
    return null;
  }

  return {
    username,
    password,
  };
}

function getBootstrapVersion(username: string, password: string) {
  const normalizedUsername = normalizeUsername(username);
  const explicitSessionSecret = process.env[ADMIN_SESSION_SECRET_ENV_VAR]?.trim();

  if (!explicitSessionSecret) {
    return `env:${normalizedUsername}`;
  }

  const versionDigest = createHmac("sha256", explicitSessionSecret)
    .update(`bootstrap:${normalizedUsername}:${password}`)
    .digest("hex")
    .slice(0, 24);
  return `env:${normalizedUsername}:${versionDigest}`;
}

export function getBootstrapAdminPrincipal(): AdminPrincipal | null {
  const credentials = getBootstrapCredentials();
  if (!credentials) {
    return null;
  }

  if (validateAdminPassword(credentials.password)) {
    return null;
  }

  return {
    id: BOOTSTRAP_ADMIN_ID,
    username: credentials.username,
    displayName: BOOTSTRAP_ADMIN_LABEL,
    role: "owner",
    source: "env",
    version: getBootstrapVersion(credentials.username, credentials.password),
  };
}

export function getBootstrapAdminSummary(): AdminAccountSummary | null {
  const principal = getBootstrapAdminPrincipal();
  if (!principal) {
    return null;
  }

  return {
    id: principal.id,
    username: principal.username,
    displayName: principal.displayName,
    isActive: true,
    role: principal.role,
    source: principal.source,
  };
}

function hashPassword(password: string, saltBase64?: string) {
  const saltBuffer = saltBase64 ? Buffer.from(saltBase64, "base64") : randomBytes(16);
  const derived = scryptSync(password, saltBuffer, 64);
  return {
    passwordHash: derived.toString("base64"),
    passwordSalt: saltBuffer.toString("base64"),
  };
}

function verifyPassword(password: string, record: ManagedAdminUserRecord) {
  if (!hasPassword(record)) {
    return false;
  }
  const derived = scryptSync(password, Buffer.from(record.passwordSalt, "base64"), 64);
  return timingSafeEqual(derived, Buffer.from(record.passwordHash, "base64"));
}

function validateManagedAdminUserInput(
  input: ManagedAdminUserInput,
  options: {
    requirePassword: boolean;
    existingUsers: ManagedAdminUserRecord[];
    currentUserId?: string;
    editingUserId?: string;
  },
) {
  const errors: string[] = [];
  const username = normalizeUsername(input.username);
  const displayName = sanitizeDisplayName(input.displayName);
  const password = input.password ?? "";
  const isActive = input.isActive ?? true;
  const bootstrapUsername = normalizeUsername(process.env[ADMIN_USERNAME_ENV_VAR] ?? "");

  if (!username) {
    errors.push("Username is required.");
  } else if (!USERNAME_PATTERN.test(username)) {
    errors.push("Username may only use lowercase letters, numbers, dots, dashes, underscores, and @.");
  }

  if (bootstrapUsername && username === bootstrapUsername) {
    errors.push("That username is reserved for the bootstrap owner account.");
  }

  const duplicate = options.existingUsers.find(
    (user) => user.username === username && user.id !== options.editingUserId,
  );
  if (duplicate) {
    errors.push(`Username "${username}" is already in use.`);
  }

  if (options.requirePassword && !password) {
    errors.push("Password is required.");
  }

  if (password) {
    const passwordError = validateAdminPassword(password);
    if (passwordError) {
      errors.push(passwordError);
    }
  }

  if (options.editingUserId && options.currentUserId === options.editingUserId && !isActive) {
    errors.push("You cannot deactivate the account you are currently using.");
  }

  return {
    username,
    displayName,
    password,
    isActive,
    errors,
  };
}

async function writeManagedAdminUser(record: ManagedAdminUserRecord) {
  await ensureAdminUsersDir();
  await writeFile(adminUserFilePath(record.id), `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

async function writeManagedAdminUserToDatabase(record: ManagedAdminUserRecord, isExisting: boolean) {
  await ensureManagedAdminsTable();

  if (isExisting) {
    await query(
      `
        UPDATE admin_users
        SET username = $2,
            display_name = $3,
            password_hash = $4,
            password_salt = $5,
            updated_at = $6,
            is_active = $7,
            reset_nonce = $8
        WHERE id = $1
      `,
      [
        record.id,
        record.username,
        record.displayName ?? null,
        record.passwordHash,
        record.passwordSalt,
        record.updatedAt,
        record.isActive,
        record.resetNonce ?? null,
      ],
    );
    return;
  }

  await query(
    `
      INSERT INTO admin_users (
        id,
        username,
        display_name,
        password_hash,
        password_salt,
        created_at,
        updated_at,
        is_active,
        reset_nonce
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
    [
      record.id,
      record.username,
      record.displayName ?? null,
      record.passwordHash,
      record.passwordSalt,
      record.createdAt,
      record.updatedAt,
      record.isActive,
      record.resetNonce ?? null,
    ],
  );
}

async function deleteManagedAdminUserFromDatabase(id: string) {
  await ensureManagedAdminsTable();
  await query("DELETE FROM admin_users WHERE id = $1", [id]);
}

export async function listManagedAdminUsers() {
  return (await listManagedAdminUserRecords()).map(toManagedSummary);
}

export async function getManagedAdminUserById(id: string) {
  const record = await getManagedAdminUserRecordById(id);
  return record ? toManagedSummary(record) : null;
}

export async function authenticateAdminCredentials(username: string, password: string): Promise<AdminAuthResult> {
  const configurationError = getAdminConfigurationError();
  if (configurationError) {
    return {
      ok: false,
      status: 503,
      message: configurationError,
    };
  }

  const bootstrap = getBootstrapCredentials();
  const normalizedUsername = normalizeUsername(username);
  if (bootstrap && normalizeUsername(bootstrap.username) === normalizedUsername && constantTimeEqualString(password, bootstrap.password)) {
    return {
      ok: true,
      principal: getBootstrapAdminPrincipal() ?? undefined,
    };
  }

  const user = await getManagedAdminUserRecordByUsername(normalizedUsername);
  if (!user || !user.isActive) {
    return {
      ok: false,
      status: 401,
      message: "Invalid username or password.",
    };
  }

  if (!hasPassword(user)) {
    return {
      ok: false,
      status: 401,
      message: "Create a password for this admin account before signing in.",
    };
  }

  if (!verifyPassword(password, user)) {
    return {
      ok: false,
      status: 401,
      message: "Invalid username or password.",
    };
  }

  return {
    ok: true,
    principal: toManagedPrincipal(user),
  };
}

function invalidSessionResult(status: number, message: string): AdminAuthResult {
  return {
    ok: false,
    status,
    message,
  };
}

export async function resolveAdminPrincipalFromSession(sessionToken: string | undefined | null): Promise<AdminAuthResult> {
  const tokenResult = await readAdminSessionToken(sessionToken);
  if (!tokenResult.ok || !tokenResult.payload) {
    return invalidSessionResult(tokenResult.status ?? 401, tokenResult.message ?? "Authentication required.");
  }

  if (tokenResult.payload.source === "env") {
    const principal = getBootstrapAdminPrincipal();
    if (
      !principal ||
      tokenResult.payload.userId !== principal.id ||
      tokenResult.payload.username !== principal.username ||
      tokenResult.payload.version !== principal.version
    ) {
      return invalidSessionResult(401, "Authentication required.");
    }

    return {
      ok: true,
      principal,
    };
  }

  const user = await getManagedAdminUserRecordById(tokenResult.payload.userId);
  if (!user || !user.isActive) {
    return invalidSessionResult(401, "Authentication required.");
  }

  if (user.username !== tokenResult.payload.username || user.updatedAt !== tokenResult.payload.version) {
    return invalidSessionResult(401, "Authentication required.");
  }

  return {
    ok: true,
    principal: toManagedPrincipal(user),
  };
}

export async function getCurrentAdminAuthResult() {
  const cookieStore = await cookies();
  return resolveAdminPrincipalFromSession(cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value);
}

export async function requireAuthenticatedAdmin() {
  const result = await getCurrentAdminAuthResult();
  if (!result.ok || !result.principal) {
    throw new AdminAuthenticationError(result.status ?? 401, result.message ?? "Authentication required.");
  }

  return result.principal;
}

export async function requireOwnerAdmin() {
  const principal = await requireAuthenticatedAdmin();
  if (principal.role !== "owner") {
    throw new AdminAuthenticationError(403, "Only the bootstrap owner can manage admin users.");
  }

  return principal;
}

export function adminAuthenticationErrorResponse(error: AdminAuthenticationError) {
  return NextResponse.json({ message: error.message }, { status: error.status });
}

export async function createAdminSessionForPrincipal(principal: AdminPrincipal) {
  return createAdminSessionToken({
    userId: principal.id,
    username: principal.username,
    role: principal.role,
    source: principal.source,
    version: principal.version,
  });
}

export async function saveManagedAdminUser(
  input: ManagedAdminUserInput,
  options?: { id?: string; currentUserId?: string },
) {
  const existingUsers = await listManagedAdminUserRecords();
  const existing = options?.id ? existingUsers.find((user) => user.id === options.id) ?? null : null;
  if (options?.id && !existing) {
    throw new AdminUserActionError({
      status: 404,
      message: `Admin user "${options.id}" was not found.`,
    });
  }

  const normalized = validateManagedAdminUserInput(input, {
    requirePassword: false,
    existingUsers,
    currentUserId: options?.currentUserId,
    editingUserId: existing?.id,
  });

  if (normalized.errors.length > 0) {
    throw new AdminUserActionError({
      status: 400,
      message: "Admin user could not be saved.",
      errors: normalized.errors,
    });
  }

  const now = new Date().toISOString();
  const passwordParts = normalized.password ? hashPassword(normalized.password) : null;
  let record: ManagedAdminUserRecord = existing
    ? {
        ...existing,
        username: normalized.username,
        displayName: normalized.displayName,
        isActive: normalized.isActive,
        updatedAt: now,
        passwordHash: passwordParts?.passwordHash ?? existing.passwordHash,
        passwordSalt: passwordParts?.passwordSalt ?? existing.passwordSalt,
        resetNonce: passwordParts ? null : existing.resetNonce,
      }
    : {
        id: buildAdminUserId(normalized.username, new Set(existingUsers.map((user) => user.id))),
        username: normalized.username,
        displayName: normalized.displayName,
        createdAt: now,
        updatedAt: now,
        isActive: normalized.isActive,
        passwordHash: passwordParts?.passwordHash ?? "",
        passwordSalt: passwordParts?.passwordSalt ?? "",
        resetNonce: null,
      };

  const storageMode = getManagedAdminStorageMode();
  let remainingIdRetries = existing ? 0 : 1;

  for (;;) {
    try {
      if (storageMode === "database") {
        await writeManagedAdminUserToDatabase(record, Boolean(existing));
      } else {
        await writeManagedAdminUser(record);
      }
      break;
    } catch (error) {
      const violationKind = getPostgresUniqueViolationKind(error);
      if (!violationKind) {
        throw error;
      }

      if (violationKind === "username") {
        throw new AdminUserActionError({
          status: 400,
          message: "Admin user could not be saved.",
          errors: [`Username "${normalized.username}" is already in use.`],
        });
      }

      if (violationKind === "id" && remainingIdRetries > 0) {
        remainingIdRetries -= 1;
        const refreshedUsers = await listManagedAdminUserRecords();
        record = {
          ...record,
          id: buildAdminUserId(normalized.username, new Set(refreshedUsers.map((user) => user.id))),
        };
        continue;
      }

      throw new AdminUserActionError({
        status: 409,
        message: "Admin user could not be saved.",
        errors: [
          violationKind === "id"
            ? "A conflicting admin record was created concurrently. Please try again."
            : "A conflicting admin record already exists in the database.",
        ],
      });
    }
  }

  return toManagedSummary(record);
}

export async function deleteManagedAdminUser(id: string) {
  const user = await getManagedAdminUserRecordById(id);
  if (!user) {
    throw new AdminUserActionError({
      status: 404,
      message: `Admin user "${id}" was not found.`,
    });
  }

  if (getManagedAdminStorageMode() === "database") {
    await deleteManagedAdminUserFromDatabase(id);
    return;
  }

  await unlink(adminUserFilePath(id)).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") {
      return;
    }

    throw error;
  });
}

export async function listAdminAccounts() {
  const bootstrap = getBootstrapAdminSummary();
  const users = await listManagedAdminUsers();
  return {
    bootstrap,
    users,
  };
}

export async function getAdminAccessStatus(username: string): Promise<AdminAccessStatusResult> {
  const configurationError = getAdminConfigurationError();
  if (configurationError) {
    return { ok: false, status: 503, message: configurationError };
  }

  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) {
    return { ok: false, status: 400, message: "Username is required." };
  }

  const bootstrap = getBootstrapCredentials();
  if (bootstrap && normalizeUsername(bootstrap.username) === normalizedUsername) {
    return { ok: true, mode: "sign_in" };
  }

  const user = await getManagedAdminUserRecordByUsername(normalizedUsername);
  if (!user || !user.isActive) {
    return { ok: false, status: 404, message: "That admin account was not found or is inactive." };
  }

  return { ok: true, mode: hasPassword(user) ? "sign_in" : "claim" };
}

export async function claimAdminPassword(username: string, password: string): Promise<AdminAuthResult> {
  const configurationError = getAdminConfigurationError();
  if (configurationError) {
    return { ok: false, status: 503, message: configurationError };
  }

  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername || !password) {
    return { ok: false, status: 400, message: "Username and password are required." };
  }

  const passwordError = validateAdminPassword(password);
  if (passwordError) {
    return { ok: false, status: 400, message: passwordError };
  }

  const user = await getManagedAdminUserRecordByUsername(normalizedUsername);
  if (!user || !user.isActive) {
    return { ok: false, status: 404, message: "That admin account was not found or is inactive." };
  }

  if (hasPassword(user)) {
    return { ok: false, status: 409, message: "This admin account already has a password. Sign in instead." };
  }

  const passwordParts = hashPassword(password);
  const now = new Date().toISOString();
  const record: ManagedAdminUserRecord = {
    ...user,
    passwordHash: passwordParts.passwordHash,
    passwordSalt: passwordParts.passwordSalt,
    resetNonce: null,
    updatedAt: now,
  };

  if (getManagedAdminStorageMode() === "database") {
    await writeManagedAdminUserToDatabase(record, true);
  } else {
    await writeManagedAdminUser(record);
  }

  return { ok: true, principal: toManagedPrincipal(record) };
}

export const ADMIN_RESET_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

interface AdminResetTokenPayload {
  username: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
}

function getAdminHmacSecret() {
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

function signAdminPayload(payload: string) {
  const secret = getAdminHmacSecret();
  if (!secret) {
    throw new Error(getAdminConfigurationError() ?? "Admin authentication is not configured.");
  }
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export async function createAdminResetToken(username: string): Promise<string> {
  const configurationError = getAdminConfigurationError();
  if (configurationError) {
    throw new AdminUserActionError({ status: 503, message: configurationError });
  }

  const normalizedUsername = normalizeUsername(username);
  const user = await getManagedAdminUserRecordByUsername(normalizedUsername);
  if (!user) {
    throw new AdminUserActionError({ status: 404, message: "Admin user was not found." });
  }

  const nonce = randomBytes(16).toString("hex");
  const expiresAt = Date.now() + ADMIN_RESET_TOKEN_TTL_MS;
  const record: ManagedAdminUserRecord = {
    ...user,
    resetNonce: nonce,
  };

  if (getManagedAdminStorageMode() === "database") {
    await ensureManagedAdminsTable();
    await query(`UPDATE admin_users SET reset_nonce = $1 WHERE id = $2`, [nonce, user.id]);
  } else {
    await writeManagedAdminUser(record);
  }

  const payload = Buffer.from(
    JSON.stringify({
      username: normalizedUsername,
      nonce,
      issuedAt: Date.now(),
      expiresAt,
    } satisfies AdminResetTokenPayload),
  ).toString("base64url");
  return `${payload}.${signAdminPayload(payload)}`;
}

export async function verifyAdminResetToken(token: string): Promise<string | null> {
  if (getAdminConfigurationError()) {
    return null;
  }

  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return null;
  }

  let expectedSig: Buffer;
  try {
    expectedSig = Buffer.from(signAdminPayload(payload));
  } catch {
    return null;
  }
  const receivedSig = Buffer.from(signature);
  if (expectedSig.length !== receivedSig.length || !timingSafeEqual(expectedSig, receivedSig)) {
    return null;
  }

  let decoded: Partial<AdminResetTokenPayload>;
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<AdminResetTokenPayload>;
  } catch {
    return null;
  }

  if (
    typeof decoded.username !== "string" ||
    typeof decoded.nonce !== "string" ||
    typeof decoded.expiresAt !== "number" ||
    decoded.expiresAt <= Date.now()
  ) {
    return null;
  }

  const user = await getManagedAdminUserRecordByUsername(decoded.username);
  if (!user?.resetNonce || user.resetNonce !== decoded.nonce) {
    return null;
  }

  return normalizeUsername(decoded.username);
}

export async function resetAdminPassword(username: string, newPassword: string): Promise<void> {
  const passwordError = validateAdminPassword(newPassword);
  if (passwordError) {
    throw new Error(passwordError);
  }

  const user = await getManagedAdminUserRecordByUsername(username);
  if (!user) {
    throw new Error("Admin user was not found.");
  }

  const passwordParts = hashPassword(newPassword);
  const now = new Date().toISOString();
  const record: ManagedAdminUserRecord = {
    ...user,
    passwordHash: passwordParts.passwordHash,
    passwordSalt: passwordParts.passwordSalt,
    resetNonce: null,
    updatedAt: now,
  };

  if (getManagedAdminStorageMode() === "database") {
    await writeManagedAdminUserToDatabase(record, true);
  } else {
    await writeManagedAdminUser(record);
  }
}
