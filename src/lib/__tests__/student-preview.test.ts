import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_PASSWORD_ENV_VAR,
  ADMIN_SESSION_SECRET_ENV_VAR,
  ADMIN_USERNAME_ENV_VAR,
} from "@/lib/admin-auth";
import {
  createStudentPreviewToken,
  readStudentPreviewToken,
} from "@/lib/forms/student-preview";
import { applyStudentPortalCapabilityLock } from "@/lib/platform-user-types";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("student preview tokens", () => {
  it("creates and reads a signed preview cookie payload", async () => {
    vi.stubEnv(ADMIN_SESSION_SECRET_ENV_VAR, "preview-test-secret");

    const token = await createStudentPreviewToken("admin-1", "Student@wsu.edu");
    const payload = await readStudentPreviewToken(token);

    expect(payload).toEqual(
      expect.objectContaining({
        adminUserId: "admin-1",
        studentEmail: "student@wsu.edu",
      }),
    );
  });

  it("rejects a forged preview token", async () => {
    vi.stubEnv(ADMIN_SESSION_SECRET_ENV_VAR, "preview-test-secret");
    const token = await createStudentPreviewToken("admin-1", "student@wsu.edu");
    const forged = `${token.slice(0, -4)}xxxx`;
    expect(await readStudentPreviewToken(forged)).toBeNull();
  });

  it("rejects an expired preview token", async () => {
    vi.stubEnv(ADMIN_USERNAME_ENV_VAR, "owner");
    vi.stubEnv(ADMIN_PASSWORD_ENV_VAR, "Strong!123");

    const token = await createStudentPreviewToken("admin-1", "student@wsu.edu", Date.now() - 1_000);
    expect(await readStudentPreviewToken(token)).toBeNull();
  });
});

describe("student portal capability lock", () => {
  it("keeps forms.student only on the student role", () => {
    expect(applyStudentPortalCapabilityLock("admin", ["admin.manage", "forms.student", "viewer"])).toEqual([
      "admin.manage",
      "viewer",
    ]);
    expect(applyStudentPortalCapabilityLock("student", ["viewer"])).toEqual(["viewer", "forms.student"]);
  });
});
