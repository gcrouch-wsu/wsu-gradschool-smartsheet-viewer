import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_PASSWORD_POLICY_MESSAGE,
  ADMIN_PASSWORD_ENV_VAR,
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_SECRET_ENV_VAR,
  ADMIN_USERNAME_ENV_VAR,
  authorizeAdminSession,
  createAdminSessionToken,
  getAdminConfigurationError,
  getAdminSessionCookieSettings,
  normalizeAdminNextPath,
  readAdminSessionToken,
  validateAdminPassword,
} from "@/lib/admin-auth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("admin auth helpers", () => {
  it("fails closed when bootstrap credentials are not configured", () => {
    vi.stubEnv(ADMIN_USERNAME_ENV_VAR, "");
    vi.stubEnv(ADMIN_PASSWORD_ENV_VAR, "");

    expect(getAdminConfigurationError()).toBe(
      `Admin authentication is not configured. Set ${ADMIN_USERNAME_ENV_VAR} and ${ADMIN_PASSWORD_ENV_VAR}.`,
    );
  });

  it("enforces the admin password policy", () => {
    expect(validateAdminPassword("short")).toBe(ADMIN_PASSWORD_POLICY_MESSAGE);
    expect(validateAdminPassword("nocaps123!")).toBe(ADMIN_PASSWORD_POLICY_MESSAGE);
    expect(validateAdminPassword("NoSpecial123")).toBe(ADMIN_PASSWORD_POLICY_MESSAGE);
    expect(validateAdminPassword("Strong!123")).toBeNull();
    expect(validateAdminPassword("Abcdef1_")).toBeNull();
    expect(validateAdminPassword("Abcdef1*")).toBeNull();
  });

  it("creates and validates signed admin sessions", async () => {
    vi.stubEnv(ADMIN_USERNAME_ENV_VAR, "owner");
    vi.stubEnv(ADMIN_PASSWORD_ENV_VAR, "Strong!123");

    const sessionToken = await createAdminSessionToken({
      userId: "bootstrap-env-admin",
      username: "owner",
      role: "owner",
      source: "env",
      version: "env:owner",
    });

    await expect(authorizeAdminSession(sessionToken)).resolves.toEqual({ ok: true });
    await expect(readAdminSessionToken(sessionToken)).resolves.toMatchObject({
      ok: true,
      payload: expect.objectContaining({ username: "owner", role: "owner" }),
    });
    await expect(authorizeAdminSession(`${sessionToken}tampered`)).resolves.toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it("rejects expired admin sessions", async () => {
    vi.stubEnv(ADMIN_USERNAME_ENV_VAR, "owner");
    vi.stubEnv(ADMIN_PASSWORD_ENV_VAR, "Strong!123");

    const sessionToken = await createAdminSessionToken(
      {
        userId: "bootstrap-env-admin",
        username: "owner",
        role: "owner",
        source: "env",
        version: "env:owner",
      },
      Date.now() - 1_000,
    );

    await expect(authorizeAdminSession(sessionToken)).resolves.toEqual({
      ok: false,
      status: 401,
      message: "Session expired. Sign in again.",
    });
  });

  it("accepts an explicit session secret when provided", async () => {
    vi.stubEnv(ADMIN_USERNAME_ENV_VAR, "owner");
    vi.stubEnv(ADMIN_PASSWORD_ENV_VAR, "Strong!123");
    vi.stubEnv(ADMIN_SESSION_SECRET_ENV_VAR, "session-secret");

    const sessionToken = await createAdminSessionToken({
      userId: "bootstrap-env-admin",
      username: "owner",
      role: "owner",
      source: "env",
      version: "env:owner",
    });

    await expect(readAdminSessionToken(sessionToken)).resolves.toMatchObject({ ok: true });
  });

  it("returns safe cookie settings and workspace redirect paths", () => {
    expect(getAdminSessionCookieSettings()).toMatchObject({
      httpOnly: true,
      maxAge: expect.any(Number),
      path: "/",
      sameSite: "lax",
    });
    expect(ADMIN_SESSION_COOKIE_NAME).toBe("smartsheets_view_admin_session");
    expect(normalizeAdminNextPath("/admin/views")).toBe("/admin/views");
    expect(normalizeAdminNextPath("/forms/manage")).toBe("/forms/manage");
    expect(normalizeAdminNextPath("/admin/sign-in")).toBe("/admin");
    expect(normalizeAdminNextPath("/forms/approver/sign-in")).toBe("/admin");
    expect(normalizeAdminNextPath("/view/test")).toBe("/admin");
  });
});