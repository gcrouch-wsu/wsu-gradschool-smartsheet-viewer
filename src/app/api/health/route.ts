import { NextResponse } from "next/server";
import { isDatabaseConfigEnabled } from "@/lib/config/config-db";
import { config as formsConfig } from "@/lib/forms/config";
import { hasConfiguredConnection } from "@/lib/smartsheet-client";

export const dynamic = "force-dynamic";

/**
 * Readiness probe: reports DB, Smartsheet token/demo, and app version.
 * Does not require authentication.
 */
export async function GET() {
  const databaseConfigured = isDatabaseConfigEnabled();
  let databaseReachable: boolean | null = null;

  if (databaseConfigured) {
    try {
      const { queryConfigDb } = await import("@/lib/config/config-db");
      await queryConfigDb("SELECT 1");
      databaseReachable = true;
    } catch {
      databaseReachable = false;
    }
  }

  const smartsheetConfigured = hasConfiguredConnection() || Boolean(formsConfig.smartsheetToken);
  const demo = formsConfig.demo;

  const ready =
    (databaseConfigured ? databaseReachable === true : true) && (smartsheetConfigured || demo);

  return NextResponse.json(
    {
      status: ready ? "ok" : "degraded",
      version: process.env.npm_package_version ?? "0.1.0",
      database: {
        configured: databaseConfigured,
        reachable: databaseReachable,
      },
      smartsheet: {
        configured: smartsheetConfigured,
        demo,
      },
      checkedAt: new Date().toISOString(),
    },
    { status: ready ? 200 : 503 },
  );
}
