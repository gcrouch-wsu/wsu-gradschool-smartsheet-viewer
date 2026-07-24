import { describe, expect, it, vi } from "vitest";
import { buildEnsureCurrentAppRoleRlsSql, ensureCurrentAppRoleRls } from "@/lib/db-rls";

describe("db rls helpers", () => {
  it("builds an app-role policy statement for the target table", () => {
    const sql = buildEnsureCurrentAppRoleRlsSql("config_sources");

    expect(sql).toContain("config_sources_app_role_access");
    expect(sql).toContain("ALTER POLICY %I ON %I TO %I");
    expect(sql).toContain("CREATE POLICY %I ON %I FOR ALL TO %I USING (true) WITH CHECK (true)");
  });

  it("enables RLS before ensuring the app-role policy", async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));

    await ensureCurrentAppRoleRls(query, "config_views");

    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenNthCalledWith(1, "ALTER TABLE config_views ENABLE ROW LEVEL SECURITY");
    const secondCall = query.mock.calls[1] as unknown[] | undefined;
    expect(String(secondCall?.[0] ?? "")).toContain("config_views_app_role_access");
  });

  it("rejects unsafe table names", async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));

    await expect(ensureCurrentAppRoleRls(query, "config-views")).rejects.toThrow(/Unsafe SQL identifier/);
  });
});
