import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("forms sources unification", () => {
  const originalCwd = process.cwd();
  let tempDir = "";

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "forms-sources-unify-"));
    process.chdir(tempDir);
    await mkdir(path.join(tempDir, "config", "sources"), { recursive: true });
    await mkdir(path.join(tempDir, "config", "forms"), { recursive: true });
    await mkdir(path.join(tempDir, "config", "views"), { recursive: true });
    vi.resetModules();
    vi.stubEnv("DEMO", "false");
    // Vite loads .env into process.env; keep file-store mode for this suite.
    vi.stubEnv("DATABASE_URL", "");
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    vi.unstubAllEnvs();
    vi.resetModules();
    await rm(tempDir, { recursive: true, force: true });
  });

  it(
    "migrates legacy FormEntry rows into SourceConfig and resolves activeSheetId",
    async () => {
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
    await registry.ensureFormsSourcesMigrated();

    const forms = await registry.listForms();
    expect(forms).toHaveLength(1);
    expect(forms[0]?.id).toBe("555001");
    expect(forms[0]?.name).toBe("Parking Form");
    expect(forms[0]?.public).toBe(true);
    expect(forms[0]?.slug).toBe("parking-form");
    expect(forms[0]?.sourceConfigId).toBeTruthy();

    expect(await registry.activeSheetId()).toBe("555001");
    expect(await registry.activeSourceId()).toBe(forms[0]?.sourceConfigId);

    const { getSourceConfigById } = await import("@/lib/config/store");
    const source = await getSourceConfigById(forms[0]!.sourceConfigId!);
    expect(source?.smartsheetId).toBe(555001);
    expect(source?.formPublic).toBe(true);
    expect(source?.sourceType).toBe("sheet");
  },
    15000,
  );

  it("registerForm upserts a sheet source and selectForm activates it", async () => {
    await writeFile(
      path.join(tempDir, "config", "forms", "registry.json"),
      `${JSON.stringify({ activeSheetId: "", forms: [], migratedToSourcesAt: "2026-01-01T00:00:00.000Z" }, null, 2)}\n`,
      "utf8",
    );

    const registry = await import("@/lib/forms/registry");
    await registry.registerForm(
      {
        id: "777002",
        name: "Travel Request",
        createdAt: "2026-02-01T00:00:00.000Z",
        source: "scratch",
      },
      true,
    );

    expect(await registry.activeSheetId()).toBe("777002");
    const forms = await registry.listForms();
    expect(forms.some((f) => f.id === "777002")).toBe(true);

    const ok = await registry.selectForm(forms[0]!.sourceConfigId!);
    expect(ok).toBe(true);
    expect(await registry.activeSourceId()).toBe(forms[0]!.sourceConfigId);
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
