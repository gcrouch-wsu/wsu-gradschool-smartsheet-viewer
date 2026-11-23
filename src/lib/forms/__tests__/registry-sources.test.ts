import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, readdir, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("forms sources unification", () => {
  const originalCwd = process.cwd();
  let tempDir = "";

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "forms-sources-unify-"));
    process.chdir(tempDir);
    await mkdir(path.join(tempDir, "config", "forms"), { recursive: true });
    await mkdir(path.join(tempDir, "config", "views"), { recursive: true });
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    vi.unstubAllEnvs();
    vi.resetModules();
    await rm(tempDir, { recursive: true, force: true });
  });

  async function sourceFiles() {
    const dir = path.join(tempDir, "config", "sources");
    return readdir(dir).catch(() => [] as string[]);
  }

  it("does not write config/sources when migrating a legacy form without Postgres", async () => {
    await writeFile(
      path.join(tempDir, "config", "forms", "registry.json"),
      `${JSON.stringify(
        {
          activeSheetId: "555001",
          forms: [
            {
              id: "555001",
              name: "Parking Form",
              createdAt: "2026-01-01T00:00:00.000Z",
              source: "imported",
              slug: "parking-form",
              public: true,
              publishedAt: "2026-01-02T00:00:00.000Z",
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const registry = await import("@/lib/forms/registry");
    await expect(registry.ensureFormsSourcesMigrated()).rejects.toThrow(/DATABASE_URL/);
    expect(await sourceFiles()).toEqual([]);
  });

  it("does not write config/sources when registering a form without Postgres", async () => {
    await writeFile(
      path.join(tempDir, "config", "forms", "registry.json"),
      `${JSON.stringify({ activeSheetId: "", forms: [], migratedToSourcesAt: "2026-01-01T00:00:00.000Z" }, null, 2)}\n`,
      "utf8",
    );

    const registry = await import("@/lib/forms/registry");
    await expect(
      registry.registerForm(
        {
          id: "777002",
          name: "Travel Request",
          createdAt: "2026-02-01T00:00:00.000Z",
          source: "scratch",
        },
        true,
      ),
    ).rejects.toThrow(/DATABASE_URL/);
    expect(await sourceFiles()).toEqual([]);
    await expect(registry.listForms()).rejects.toThrow(/DATABASE_URL/);
  });

  it("does not write config/sources for a UUID sheet id without Postgres", async () => {
    await writeFile(
      path.join(tempDir, "config", "forms", "registry.json"),
      `${JSON.stringify({ activeSheetId: "", forms: [], migratedToSourcesAt: "2026-01-01T00:00:00.000Z" }, null, 2)}\n`,
      "utf8",
    );

    const registry = await import("@/lib/forms/registry");
    await expect(
      registry.registerForm(
        {
          id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
          name: "Offline Leave Form",
          createdAt: "2026-02-01T00:00:00.000Z",
          source: "scratch",
        },
        true,
      ),
    ).rejects.toThrow(/DATABASE_URL/);
    expect(await sourceFiles()).toEqual([]);
    await expect(registry.listForms()).rejects.toThrow(/DATABASE_URL/);
  });

  it("rejects publishing a report source as a form via validation", async () => {
    const { validateSourceConfig } = await import("@/lib/config/validation");
    const result = validateSourceConfig({
      id: "my-report",
      label: "Report",
      sourceType: "report",
      smartsheetId: 99,
      formPublic: true,
    });
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => /cannot be published as forms/i.test(e))).toBe(true);
  });
});
