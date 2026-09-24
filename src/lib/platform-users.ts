/**
 * Unified platform users: one account, many roles, DB-backed permission matrix.
 * Env bootstrap owner stays outside this table.
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { ensureConfigTables, isDatabaseConfigEnabled, queryConfigDb } from "@/lib/config/config-db";
import type { PrincipalCapability } from "@/lib/identity/principal";
import type { PlatformRole } from "@/lib/identity/roles";
import {
  ALL_CAPABILITIES,
  ASSIGNABLE_ROLES,
  type AssignablePlatformRole,
  OWNER_LOCKED_CAPABILITIES,
  PLATFORM_ROLES,
  type PlatformUserSummary,
  type RoleDefinition,
  type RolePermissionMatrix,
  STAFF_ROLES,
} from "@/lib/platform-user-types";

export type {
  AssignablePlatformRole,
  PlatformUserSummary,
  RoleDefinition,
  RolePermissionMatrix,
} from "@/lib/platform-user-types";
export {
  ALL_CAPABILITIES,
  ASSIGNABLE_ROLES,
  OWNER_LOCKED_CAPABILITIES,
  PLATFORM_ROLES,
  STAFF_ROLES,
} from "@/lib/platform-user-types";

export interface PlatformUserRecord {
  id: string;
  email: string;
  displayName?: string;
  passwordHash: string;
  passwordSalt: string;
  resetNonce?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  roles: PlatformRole[];
}

interface UserDbRow {
  id: string;
  email: string;
  display_name: string | null;
  password_hash: string;
  password_salt: string;
  reset_nonce: string | null;
  is_active: boolean;
  created_at: string | Date;
  updated_at: string | Date;
  roles?: string | string[] | null;
}

function toIso(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function parseRoles(raw: string | string[] | null | undefined): PlatformRole[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",").filter(Boolean) : [];
  return list.filter((r): r is PlatformRole => (PLATFORM_ROLES as readonly string[]).includes(r));
}

function hasPassword(hash: string, salt: string) {
  return Boolean(hash?.trim() && salt?.trim());
}

function toUserRecord(row: UserDbRow, roles?: PlatformRole[]): PlatformUserRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name ?? undefined,
    passwordHash: row.password_hash ?? "",
    passwordSalt: row.password_salt ?? "",
    resetNonce: row.reset_nonce,
    isActive: row.is_active,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    roles: roles ?? parseRoles(row.roles),
  };
}

function toSummary(record: PlatformUserRecord): PlatformUserSummary {
  return {
    id: record.id,
    email: record.email,
    displayName: record.displayName,
    isActive: record.isActive,
    hasPassword: hasPassword(record.passwordHash, record.passwordSalt),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    roles: record.roles,
  };
}

export function hashPlatformPassword(password: string, saltBase64?: string) {
  const salt = saltBase64 ? Buffer.from(saltBase64, "base64") : randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return {
    passwordHash: hash.toString("base64"),
    passwordSalt: salt.toString("base64"),
  };
}

export function verifyPlatformPassword(password: string, passwordHash: string, passwordSalt: string) {
  if (!passwordHash || !passwordSalt) return false;
  try {
    const expected = Buffer.from(passwordHash, "base64");
    const actual = scryptSync(password, Buffer.from(passwordSalt, "base64"), 64);
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

async function ensureTables() {
  await ensureConfigTables();
}

async function loadRolesForUserIds(userIds: string[]): Promise<Map<string, PlatformRole[]>> {
  const map = new Map<string, PlatformRole[]>();
  if (userIds.length === 0) return map;
  const { rows } = await queryConfigDb<{ user_id: string; role_id: string }>(
    `SELECT user_id::text AS user_id, role_id FROM user_roles WHERE user_id = ANY($1::uuid[])`,
    [userIds],
  );
  for (const row of rows) {
    const list = map.get(row.user_id) ?? [];
    if ((PLATFORM_ROLES as readonly string[]).includes(row.role_id)) {
      list.push(row.role_id as PlatformRole);
    }
    map.set(row.user_id, list);
  }
  return map;
}

export async function listPlatformUsers(options?: { role?: PlatformRole }): Promise<PlatformUserSummary[]> {
  if (!isDatabaseConfigEnabled()) return [];
  await ensureTables();
  let rows: UserDbRow[];
  if (options?.role) {
    const result = await queryConfigDb<UserDbRow>(
      `SELECT u.id, u.email, u.display_name, u.password_hash, u.password_salt, u.reset_nonce,
              u.is_active, u.created_at, u.updated_at
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       WHERE ur.role_id = $1
       ORDER BY COALESCE(u.display_name, u.email), u.email`,
      [options.role],
    );
    rows = result.rows;
  } else {
    const result = await queryConfigDb<UserDbRow>(
      `SELECT id, email, display_name, password_hash, password_salt, reset_nonce,
              is_active, created_at, updated_at
       FROM users
       ORDER BY COALESCE(display_name, email), email`,
    );
    rows = result.rows;
  }
  const roleMap = await loadRolesForUserIds(rows.map((r) => r.id));
  return rows.map((row) => toSummary(toUserRecord(row, roleMap.get(row.id) ?? [])));
}

export async function getPlatformUserById(id: string): Promise<PlatformUserRecord | null> {
  if (!isDatabaseConfigEnabled()) return null;
  await ensureTables();
  const { rows } = await queryConfigDb<UserDbRow>(
    `SELECT id, email, display_name, password_hash, password_salt, reset_nonce,
            is_active, created_at, updated_at
     FROM users WHERE id = $1`,
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  const roleMap = await loadRolesForUserIds([row.id]);
  return toUserRecord(row, roleMap.get(row.id) ?? []);
}

export async function getPlatformUserByEmail(email: string): Promise<PlatformUserRecord | null> {
  if (!isDatabaseConfigEnabled()) return null;
  await ensureTables();
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const { rows } = await queryConfigDb<UserDbRow>(
    `SELECT id, email, display_name, password_hash, password_salt, reset_nonce,
            is_active, created_at, updated_at
     FROM users WHERE email = $1`,
    [normalized],
  );
  const row = rows[0];
  if (!row) return null;
  const roleMap = await loadRolesForUserIds([row.id]);
  return toUserRecord(row, roleMap.get(row.id) ?? []);
}

export async function setUserRoles(userId: string, roles: readonly AssignablePlatformRole[]) {
  await ensureTables();
  const unique = [...new Set(roles.filter((r) => ASSIGNABLE_ROLES.includes(r)))];
  await queryConfigDb(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);
  for (const role of unique) {
    await queryConfigDb(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
      userId,
      role,
    ]);
  }
}

export async function addUserRole(userId: string, role: AssignablePlatformRole) {
  await ensureTables();
  await queryConfigDb(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
    userId,
    role,
  ]);
}

export interface SavePlatformUserInput {
  id?: string;
  email: string;
  displayName?: string | null;
  roles: AssignablePlatformRole[];
  isActive?: boolean;
  password?: string | null;
}

export async function savePlatformUser(input: SavePlatformUserInput): Promise<PlatformUserSummary> {
  await ensureTables();
  const email = normalizeEmail(input.email);
  if (!email) {
    throw new Error("Email is required.");
  }
  if (!input.roles.length) {
    throw new Error("At least one role is required.");
  }
  const invalid = input.roles.filter((r) => !ASSIGNABLE_ROLES.includes(r));
  if (invalid.length) {
    throw new Error(`Invalid role(s): ${invalid.join(", ")}`);
  }

  let passwordHash = "";
  let passwordSalt = "";
  if (input.password) {
    const hashed = hashPlatformPassword(input.password);
    passwordHash = hashed.passwordHash;
    passwordSalt = hashed.passwordSalt;
  }

  if (input.id) {
    const existing = await getPlatformUserById(input.id);
    if (!existing) throw new Error("User not found.");
    const updates: string[] = [
      `email = $2`,
      `display_name = $3`,
      `is_active = $4`,
      `updated_at = now()`,
    ];
    const params: unknown[] = [
      input.id,
      email,
      input.displayName?.trim() || null,
      input.isActive ?? existing.isActive,
    ];
    if (input.password) {
      updates.push(`password_hash = $5`, `password_salt = $6`, `reset_nonce = NULL`);
      params.push(passwordHash, passwordSalt);
    }
    await queryConfigDb(`UPDATE users SET ${updates.join(", ")} WHERE id = $1`, params);
    await setUserRoles(input.id, input.roles);
    const updated = await getPlatformUserById(input.id);
    if (!updated) throw new Error("User not found after update.");
    return toSummary(updated);
  }

  const existingByEmail = await getPlatformUserByEmail(email);
  if (existingByEmail) {
    throw new Error("A user with this email already exists.");
  }

  const { rows } = await queryConfigDb<{ id: string }>(
    `INSERT INTO users (email, display_name, password_hash, password_salt, is_active)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [email, input.displayName?.trim() || null, passwordHash, passwordSalt, input.isActive ?? true],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("Failed to create user.");
  await setUserRoles(id, input.roles);
  const created = await getPlatformUserById(id);
  if (!created) throw new Error("User not found after create.");
  return toSummary(created);
}

export async function deletePlatformUser(id: string) {
  await ensureTables();
  await queryConfigDb(`DELETE FROM users WHERE id = $1`, [id]);
}

export async function createOrUpdateUserWithRole(
  email: string,
  password: string,
  role: AssignablePlatformRole,
): Promise<PlatformUserRecord> {
  await ensureTables();
  const normalized = normalizeEmail(email);
  const { passwordHash, passwordSalt } = hashPlatformPassword(password);
  const existing = await getPlatformUserByEmail(normalized);
  if (existing) {
    if (hasPassword(existing.passwordHash, existing.passwordSalt)) {
      throw new Error("ACCOUNT_EXISTS");
    }
    await queryConfigDb(
      `UPDATE users SET password_hash = $1, password_salt = $2, reset_nonce = NULL, updated_at = now() WHERE id = $3`,
      [passwordHash, passwordSalt, existing.id],
    );
    await addUserRole(existing.id, role);
    const updated = await getPlatformUserById(existing.id);
    if (!updated) throw new Error("User not found.");
    return updated;
  }
  const { rows } = await queryConfigDb<{ id: string }>(
    `INSERT INTO users (email, password_hash, password_salt, is_active)
     VALUES ($1, $2, $3, true)
     RETURNING id`,
    [normalized, passwordHash, passwordSalt],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("Failed to create user.");
  await addUserRole(id, role);
  const created = await getPlatformUserById(id);
  if (!created) throw new Error("User not found.");
  return created;
}

export async function updatePlatformUserPassword(userId: string, password: string) {
  await ensureTables();
  const { passwordHash, passwordSalt } = hashPlatformPassword(password);
  await queryConfigDb(
    `UPDATE users SET password_hash = $1, password_salt = $2, reset_nonce = NULL, updated_at = now() WHERE id = $3`,
    [passwordHash, passwordSalt, userId],
  );
}

export async function createPlatformResetToken(userId: string): Promise<string> {
  await ensureTables();
  const user = await getPlatformUserById(userId);
  if (!user) throw new Error("User not found.");
  const nonce = randomBytes(24).toString("hex");
  await queryConfigDb(`UPDATE users SET reset_nonce = $1, updated_at = now() WHERE id = $2`, [nonce, userId]);
  const payload = Buffer.from(JSON.stringify({ userId, email: user.email, nonce })).toString("base64url");
  const secret = process.env.SMARTSHEETS_VIEW_ADMIN_SESSION_SECRET?.trim()
    || process.env.CONTRIBUTOR_SESSION_SECRET?.trim()
    || "platform-reset";
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export async function consumePlatformResetToken(
  token: string,
  password: string,
): Promise<{ ok: true; user: PlatformUserRecord } | { ok: false; message: string }> {
  await ensureTables();
  const [payloadPart, sig] = token.split(".");
  if (!payloadPart || !sig) {
    return { ok: false, message: "Invalid or expired reset link." };
  }
  const secret = process.env.SMARTSHEETS_VIEW_ADMIN_SESSION_SECRET?.trim()
    || process.env.CONTRIBUTOR_SESSION_SECRET?.trim()
    || "platform-reset";
  const expected = createHmac("sha256", secret).update(payloadPart).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return { ok: false, message: "Invalid or expired reset link." };
    }
  } catch {
    return { ok: false, message: "Invalid or expired reset link." };
  }
  let parsed: { userId?: string; email?: string; nonce?: string };
  try {
    parsed = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
  } catch {
    return { ok: false, message: "Invalid or expired reset link." };
  }
  if (!parsed.userId || !parsed.nonce) {
    return { ok: false, message: "Invalid or expired reset link." };
  }
  const user = await getPlatformUserById(parsed.userId);
  if (!user || user.resetNonce !== parsed.nonce) {
    return { ok: false, message: "Invalid or expired reset link." };
  }
  await updatePlatformUserPassword(user.id, password);
  const updated = await getPlatformUserById(user.id);
  if (!updated) return { ok: false, message: "User not found." };
  return { ok: true, user: updated };
}

export async function authenticatePlatformUser(
  email: string,
  password: string,
): Promise<PlatformUserRecord | null> {
  const user = await getPlatformUserByEmail(email);
  if (!user || !user.isActive) return null;
  if (!verifyPlatformPassword(password, user.passwordHash, user.passwordSalt)) return null;
  return user;
}

export async function capabilitiesForUserRoles(roles: readonly PlatformRole[]): Promise<PrincipalCapability[]> {
  if (!roles.length) return [];
  if (!isDatabaseConfigEnabled()) {
    const { capabilitiesForRoles } = await import("@/lib/identity/roles");
    return capabilitiesForRoles([...roles]);
  }
  await ensureTables();
  const { rows } = await queryConfigDb<{ capability: string }>(
    `SELECT DISTINCT capability FROM role_permissions WHERE role_id = ANY($1::text[])`,
    [roles],
  );
  const caps = rows
    .map((r) => r.capability)
    .filter((c): c is PrincipalCapability => (ALL_CAPABILITIES as readonly string[]).includes(c));
  return caps;
}

export async function getRolePermissionMatrix(): Promise<RolePermissionMatrix> {
  await ensureTables();
  const { rows: roleRows } = await queryConfigDb<{
    id: string;
    label: string;
    description: string | null;
    sort_order: number;
  }>(`SELECT id, label, description, sort_order FROM roles ORDER BY sort_order, id`);
  const { rows: permRows } = await queryConfigDb<{ role_id: string; capability: string }>(
    `SELECT role_id, capability FROM role_permissions`,
  );
  const roles: RoleDefinition[] = roleRows
    .filter((r) => (PLATFORM_ROLES as readonly string[]).includes(r.id))
    .map((r) => ({
      id: r.id as PlatformRole,
      label: r.label,
      description: r.description ?? undefined,
      sortOrder: r.sort_order,
    }));
  const matrix: Record<string, Record<string, boolean>> = {};
  for (const role of roles) {
    matrix[role.id] = Object.fromEntries(ALL_CAPABILITIES.map((c) => [c, false]));
  }
  for (const row of permRows) {
    if (!matrix[row.role_id]) continue;
    if ((ALL_CAPABILITIES as readonly string[]).includes(row.capability)) {
      matrix[row.role_id][row.capability] = true;
    }
  }
  return { roles, capabilities: [...ALL_CAPABILITIES], matrix };
}

export async function saveRolePermissionMatrix(
  updates: Record<string, PrincipalCapability[]>,
): Promise<RolePermissionMatrix> {
  await ensureTables();
  for (const [roleId, caps] of Object.entries(updates)) {
    if (!(PLATFORM_ROLES as readonly string[]).includes(roleId)) continue;
    let nextCaps = [...new Set(caps.filter((c) => (ALL_CAPABILITIES as readonly string[]).includes(c)))];
    if (roleId === "owner") {
      for (const locked of OWNER_LOCKED_CAPABILITIES) {
        if (!nextCaps.includes(locked)) nextCaps.push(locked);
      }
    }
    await queryConfigDb(`DELETE FROM role_permissions WHERE role_id = $1`, [roleId]);
    for (const cap of nextCaps) {
      await queryConfigDb(
        `INSERT INTO role_permissions (role_id, capability) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [roleId, cap],
      );
    }
  }
  return getRolePermissionMatrix();
}

/** Highest-privilege staff role for legacy AdminPrincipal.role compatibility. */
export function primaryStaffRole(roles: readonly PlatformRole[]): "owner" | "admin" | "coordinator" | "programs_team" | null {
  if (roles.includes("owner")) return "owner";
  if (roles.includes("admin")) return "admin";
  if (roles.includes("programs_team")) return "programs_team";
  if (roles.includes("coordinator")) return "coordinator";
  return null;
}

export function userHasStaffRole(roles: readonly PlatformRole[]) {
  return roles.some((r) => r === "owner" || STAFF_ROLES.includes(r as AssignablePlatformRole));
}

export function postLoginPath(capabilities: readonly PrincipalCapability[]): string {
  if (capabilities.includes("admin.manage")) return "/admin";
  if (capabilities.includes("forms.coordinator") || capabilities.includes("forms.approver")) {
    return "/forms/sheet";
  }
  if (capabilities.includes("forms.student")) return "/forms/my";
  if (capabilities.includes("contributor.edit")) return "/";
  return "/";
}

export function isDatabaseUsersEnabled() {
  return isDatabaseConfigEnabled();
}
