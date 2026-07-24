import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

interface MockDbUser {
  id: string;
  username: string;
  display_name: string | null;
  password_hash: string;
  password_salt: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

const {
  mockDbUsers,
  mockInsertConflictUsernames,
  mockInsertConflictIds,
  resetMockDb,
  runMockQuery,
} = vi.hoisted(() => {
  const mockDbUsers: MockDbUser[] = [];
  const mockAdminLoginAttempts: { ip: string }[] = [];
  const mockInsertConflictUsernames = new Set<string>();
  const mockInsertConflictIds = new Set<string>();

  function resetMockDb() {
    mockDbUsers.length = 0;
    mockAdminLoginAttempts.length = 0;
    mockInsertConflictUsernames.clear();
    mockInsertConflictIds.clear();
  }

  function cloneRow(user: MockDbUser) {
    return { ...user };
  }

  function compareUsers(left: MockDbUser, right: MockDbUser) {
    const leftLabel = left.display_name ?? left.username;
    const rightLabel = right.display_name ?? right.username;
    return leftLabel.localeCompare(rightLabel);
  }

  async function runMockQuery(text: string, params: unknown[] = []) {
    const sql = text.replace(/\s+/g, " ").trim();

    // Versioned migrations + RLS DDL (idempotent no-ops in unit tests).
    if (
      sql.includes("CREATE TABLE IF NOT EXISTS schema_migrations") ||
      sql.includes("CREATE TABLE IF NOT EXISTS config_sources") ||
      sql.includes("CREATE TABLE IF NOT EXISTS admin_users") ||
      sql.startsWith("CREATE TABLE IF NOT EXISTS") ||
      sql.startsWith("CREATE INDEX IF NOT EXISTS") ||
      sql.startsWith("ALTER TABLE") ||
      sql.startsWith("DO $$ BEGIN") ||
      sql.includes("-- Platform schema")
    ) {
      return { rows: [], rowCount: 0 };
    }

    if (sql.startsWith("SELECT id FROM schema_migrations")) {
      return { rows: [], rowCount: 0 };
    }

    if (sql.startsWith("INSERT INTO schema_migrations")) {
      return { rows: [], rowCount: 1 };
    }

    if (sql.startsWith("SELECT COUNT(*)::int AS count FROM admin_users")) {
      return { rows: [{ count: mockDbUsers.length }], rowCount: 1 };
    }

    if (sql.startsWith("SELECT id, username") && sql.includes("FROM admin_users WHERE id = $1")) {
      const user = mockDbUsers.find((entry) => entry.id === params[0]);
      return { rows: user ? [cloneRow(user)] : [], rowCount: user ? 1 : 0 };
    }

    if (sql.startsWith("SELECT id, username") && sql.includes("FROM admin_users WHERE username = $1")) {
      const user = mockDbUsers.find((entry) => entry.username === params[0]);
      return { rows: user ? [cloneRow(user)] : [], rowCount: user ? 1 : 0 };
    }

    if (sql.includes("FROM admin_users ORDER BY COALESCE(display_name, username), username")) {
      return {
        rows: [...mockDbUsers].sort(compareUsers).map(cloneRow),
        rowCount: mockDbUsers.length,
      };
    }

    if (sql.startsWith("INSERT INTO admin_users")) {
      const record: MockDbUser = {
        id: String(params[0]),
        username: String(params[1]).toLowerCase().trim(),
        display_name: params[2] == null ? null : String(params[2]),
        password_hash: String(params[3]),
        password_salt: String(params[4]),
        created_at: String(params[5]),
        updated_at: String(params[6]),
        is_active: Boolean(params[7]),
      };
      const existingById = mockDbUsers.findIndex((entry) => entry.id === record.id);
      const existingByUsername = mockDbUsers.findIndex((entry) => entry.username === record.username);
      if (sql.includes("ON CONFLICT (id) DO NOTHING")) {
        if (existingById === -1 && existingByUsername === -1) {
          mockDbUsers.push(record);
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      const usernameNorm = record.username.toLowerCase().trim();
      if (mockInsertConflictIds.has(record.id)) {
        mockInsertConflictIds.delete(record.id);
        if (existingById === -1) {
          mockDbUsers.push({
            ...record,
            username: `occupied-${record.id}@example.com`,
            display_name: "Occupied",
          });
        }
        const err = new Error("duplicate key value violates unique constraint") as Error & {
          code?: string;
          constraint?: string;
          detail?: string;
        };
        err.code = "23505";
        err.constraint = "admin_users_pkey";
        err.detail = `Key (id)=(${record.id}) already exists.`;
        throw err;
      }

      if (existingByUsername >= 0 || mockInsertConflictUsernames.has(usernameNorm)) {
        const err = new Error("duplicate key value violates unique constraint") as Error & {
          code?: string;
          constraint?: string;
          detail?: string;
        };
        err.code = "23505";
        err.constraint = "admin_users_username_key";
        err.detail = `Key (username)=(${record.username}) already exists.`;
        throw err;
      }
      if (existingById >= 0) {
        const err = new Error("duplicate key value violates unique constraint") as Error & {
          code?: string;
          constraint?: string;
          detail?: string;
        };
        err.code = "23505";
        err.constraint = "admin_users_pkey";
        err.detail = `Key (id)=(${record.id}) already exists.`;
        throw err;
      }
      mockDbUsers.push(record);
      return { rows: [], rowCount: 1 };
    }

    if (sql.startsWith("UPDATE admin_users SET username = $2")) {
      const user = mockDbUsers.find((entry) => entry.id === params[0]);
      if (!user) {
        return { rows: [], rowCount: 0 };
      }

      user.username = String(params[1]);
      user.display_name = params[2] == null ? null : String(params[2]);
      user.password_hash = String(params[3]);
      user.password_salt = String(params[4]);
      user.updated_at = String(params[5]);
      user.is_active = Boolean(params[6]);
      return { rows: [], rowCount: 1 };
    }

    if (sql.startsWith("DELETE FROM admin_users WHERE id = $1")) {
      const before = mockDbUsers.length;
      const next = mockDbUsers.filter((entry) => entry.id !== params[0]);
      mockDbUsers.splice(0, mockDbUsers.length, ...next);
      return { rows: [], rowCount: before - next.length };
    }

    if (sql.startsWith("INSERT INTO admin_login_attempts")) {
      mockAdminLoginAttempts.push({ ip: String(params[0]) });
      return { rows: [], rowCount: 1 };
    }

    if (sql.startsWith("DELETE FROM admin_login_attempts WHERE attempted_at")) {
      return { rows: [], rowCount: 0 };
    }

    if (sql.includes("FROM admin_login_attempts") && sql.includes("COUNT") && sql.includes("ip = $1")) {
      const ip = String(params[0]);
      const count = mockAdminLoginAttempts.filter((row) => row.ip === ip).length;
      return { rows: [{ count: String(count) }], rowCount: 1 };
    }

    throw new Error(`Unhandled mock SQL: ${sql}`);
  }

  return {
    mockDbUsers,
    mockAdminLoginAttempts,
    mockInsertConflictUsernames,
    mockInsertConflictIds,
    resetMockDb,
    runMockQuery,
  };
});

type PgMockGlobal = typeof globalThis & {
  __smartsheetsViewPgMockQuery?: typeof runMockQuery;
};

const originalCwd = process.cwd();
let tempDir = "";

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "smartsheets-view-admin-"));
  process.chdir(tempDir);
  resetMockDb();
  (globalThis as PgMockGlobal).__smartsheetsViewPgMockQuery = runMockQuery;
  delete (globalThis as { __smartsheetsViewAdminPool?: unknown }).__smartsheetsViewAdminPool;
  delete (globalThis as { __smartsheetsViewConfigPool?: unknown }).__smartsheetsViewConfigPool;
  vi.resetModules();
  vi.stubEnv("SMARTSHEETS_VIEW_ADMIN_USERNAME", "owner");
  vi.stubEnv("SMARTSHEETS_VIEW_ADMIN_PASSWORD", "Owner!234");
  vi.stubEnv("DATABASE_URL", "");
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
  resetMockDb();
  delete (globalThis as PgMockGlobal).__smartsheetsViewPgMockQuery;
  delete (globalThis as { __smartsheetsViewAdminPool?: unknown }).__smartsheetsViewAdminPool;
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("managed admin users", () => {
  it("authenticates the bootstrap owner from env", async () => {
    const users = await import("@/lib/admin-users");

    const result = await users.authenticateAdminCredentials("owner", "Owner!234");

    expect(result.ok).toBe(true);
    expect(result.principal).toMatchObject({ role: "owner", source: "env", username: "owner" });
  });

  it("creates and authenticates managed admin users in file mode", async () => {
    const users = await import("@/lib/admin-users");

    const created = await users.saveManagedAdminUser({
      username: "jane@example.com",
      displayName: "Jane Example",
      password: "Admin!234",
      isActive: true,
    });
    const result = await users.authenticateAdminCredentials("jane@example.com", "Admin!234");

    expect(users.getManagedAdminStorageMode()).toBe("file");
    expect(created.username).toBe("jane@example.com");
    expect(result.ok).toBe(true);
    expect(result.principal).toMatchObject({ role: "admin", source: "managed", username: "jane@example.com" });
  });

  it("creates and authenticates managed admin users in database mode", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://example:example@example.com:5432/smartsheets_view");
    const users = await import("@/lib/admin-users");

    const created = await users.saveManagedAdminUser({
      username: "dbadmin@example.com",
      displayName: "DB Admin",
      password: "Admin!234",
      isActive: true,
    });
    const result = await users.authenticateAdminCredentials("dbadmin@example.com", "Admin!234");

    expect(users.getManagedAdminStorageMode()).toBe("database");
    expect(created.username).toBe("dbadmin@example.com");
    expect(result.ok).toBe(true);
    expect(result.principal).toMatchObject({ role: "admin", source: "managed", username: "dbadmin@example.com" });
    expect(mockDbUsers).toHaveLength(1);
  });

  it("invalidates existing managed sessions when the user is updated", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://example:example@example.com:5432/smartsheets_view");
    const users = await import("@/lib/admin-users");

    const created = await users.saveManagedAdminUser({
      username: "jane@example.com",
      displayName: "Jane Example",
      password: "Admin!234",
      isActive: true,
    });
    const login = await users.authenticateAdminCredentials("jane@example.com", "Admin!234");
    const sessionToken = await users.createAdminSessionForPrincipal(login.principal!);

    await expect(users.resolveAdminPrincipalFromSession(sessionToken)).resolves.toMatchObject({
      ok: true,
      principal: expect.objectContaining({ id: created.id }),
    });

    await users.saveManagedAdminUser(
      {
        username: "jane@example.com",
        displayName: "Jane Updated",
        isActive: true,
      },
      { id: created.id },
    );

    await expect(users.resolveAdminPrincipalFromSession(sessionToken)).resolves.toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it("deletes database-backed managed admin users", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://example:example@example.com:5432/smartsheets_view");
    const users = await import("@/lib/admin-users");

    const created = await users.saveManagedAdminUser({
      username: "remove@example.com",
      password: "Admin!234",
      isActive: true,
    });

    await users.deleteManagedAdminUser(created.id);

    await expect(users.getManagedAdminUserById(created.id)).resolves.toBeNull();
    expect(mockDbUsers).toHaveLength(0);
  });

  it("rejects duplicate or reserved usernames", async () => {
    const users = await import("@/lib/admin-users");

    await users.saveManagedAdminUser({
      username: "jane@example.com",
      password: "Admin!234",
      isActive: true,
    });

    await expect(
      users.saveManagedAdminUser({
        username: "owner",
        password: "Admin!234",
        isActive: true,
      }),
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      users.saveManagedAdminUser({
        username: "jane@example.com",
        password: "Admin!234",
        isActive: true,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("invalidates bootstrap session when password changes even with an explicit session secret", async () => {
    vi.stubEnv("SMARTSHEETS_VIEW_ADMIN_SESSION_SECRET", "session-secret");
    const users = await import("@/lib/admin-users");
    const auth = await import("@/lib/admin-auth");

    const login = await users.authenticateAdminCredentials("owner", "Owner!234");
    expect(login.ok).toBe(true);
    const sessionToken = await users.createAdminSessionForPrincipal(login.principal!);
    const tokenResult = await auth.readAdminSessionToken(sessionToken);
    const rawPasswordDigest = createHash("sha256").update("Owner!234").digest("hex").slice(0, 16);

    expect(tokenResult).toMatchObject({
      ok: true,
      payload: expect.objectContaining({ version: expect.stringMatching(/^env:owner(?::.+)?$/) }),
    });
    expect(tokenResult.ok && tokenResult.payload?.version).not.toContain(rawPasswordDigest);

    await expect(users.resolveAdminPrincipalFromSession(sessionToken)).resolves.toMatchObject({
      ok: true,
      principal: expect.objectContaining({ username: "owner" }),
    });

    vi.stubEnv("SMARTSHEETS_VIEW_ADMIN_PASSWORD", "Owner!999");
    vi.resetModules();
    const usersAfter = await import("@/lib/admin-users");

    await expect(usersAfter.resolveAdminPrincipalFromSession(sessionToken)).resolves.toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it("migration skips duplicate usernames in file records", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://example:example@example.com:5432/smartsheets_view");
    const { mkdir, writeFile } = await import("node:fs/promises");
    const adminUsersDir = path.join(process.cwd(), "config", "admin-users");
    await mkdir(adminUsersDir, { recursive: true });

    const record = {
      id: "jane-at-example-com",
      username: "jane@example.com",
      displayName: "Jane",
      passwordHash: "dGVzdA==",
      passwordSalt: "dGVzdA==",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      isActive: true,
    };
    await writeFile(path.join(adminUsersDir, "jane.json"), JSON.stringify(record, null, 2));
    await writeFile(path.join(adminUsersDir, "jane-2.json"), JSON.stringify({ ...record, id: "jane-2" }, null, 2));

    const users = await import("@/lib/admin-users");
    const list = await users.listManagedAdminUsers();

    expect(list).toHaveLength(1);
    expect(list[0].username).toBe("jane@example.com");
  });

  it("retries once when a concurrent create collides on the generated id", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://example:example@example.com:5432/smartsheets_view?sslmode=verify-full");
    mockInsertConflictIds.add("race-at-example-com");
    const users = await import("@/lib/admin-users");

    const created = await users.saveManagedAdminUser({
      username: "race@example.com",
      password: "Admin!234",
      isActive: true,
    });

    expect(created.id).toBe("race-at-example-com-2");
    expect(mockDbUsers.some((entry) => entry.id === "race-at-example-com")).toBe(true);
    expect(mockDbUsers.some((entry) => entry.id === "race-at-example-com-2")).toBe(true);
  });

  it("rate limits failed admin logins in memory when DATABASE_URL is unset", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const users = await import("@/lib/admin-users");
    const ip = "203.0.113.50";
    for (let i = 0; i < users.ADMIN_LOGIN_RATE_LIMIT_MAX_ATTEMPTS - 1; i++) {
      expect(await users.isAdminLoginRateLimited(ip)).toBe(false);
      await users.recordAdminFailedLoginAttempt(ip);
    }
    expect(await users.isAdminLoginRateLimited(ip)).toBe(false);
    await users.recordAdminFailedLoginAttempt(ip);
    expect(await users.isAdminLoginRateLimited(ip)).toBe(true);
  });

  it("rate limits failed admin logins against the database when DATABASE_URL is set", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://example:example@example.com:5432/smartsheets_view");
    const users = await import("@/lib/admin-users");
    const ip = "198.51.100.9";
    for (let i = 0; i < users.ADMIN_LOGIN_RATE_LIMIT_MAX_ATTEMPTS - 1; i++) {
      expect(await users.isAdminLoginRateLimited(ip)).toBe(false);
      await users.recordAdminFailedLoginAttempt(ip);
    }
    expect(await users.isAdminLoginRateLimited(ip)).toBe(false);
    await users.recordAdminFailedLoginAttempt(ip);
    expect(await users.isAdminLoginRateLimited(ip)).toBe(true);
  });

  it("returns AdminUserActionError on database unique violation for username", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://example:example@example.com:5432/smartsheets_view");
    mockInsertConflictUsernames.add("race@example.com");
    const users = await import("@/lib/admin-users");

    await expect(
      users.saveManagedAdminUser({
        username: "race@example.com",
        password: "Admin!234",
        isActive: true,
      }),
    ).rejects.toMatchObject({
      name: "AdminUserActionError",
      status: 400,
      errors: ['Username "race@example.com" is already in use.'],
    });
  });
});
