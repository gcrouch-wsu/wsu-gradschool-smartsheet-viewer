import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/admin-api";
import { auditFromPrincipal } from "@/lib/audit";
import { isDatabaseConfigEnabled } from "@/lib/config/config-db";
import { adminPrincipalToPrincipal } from "@/lib/identity";
import {
  isSmartsheetApiEnabled,
  setSmartsheetApiEnabled,
} from "@/lib/smartsheet-api-gate";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApiAccess();
  if (auth.response) {
    return auth.response;
  }

  const databaseConfigured = isDatabaseConfigEnabled();
  const enabled = databaseConfigured ? await isSmartsheetApiEnabled() : true;

  return NextResponse.json({
    enabled,
    databaseConfigured,
    canToggle: databaseConfigured,
  });
}

export async function PUT(request: Request) {
  const auth = await requireAdminApiAccess();
  if (auth.response) {
    return auth.response;
  }

  if (!isDatabaseConfigEnabled()) {
    return NextResponse.json(
      { error: "DATABASE_URL is required to change the Smartsheet API setting." },
      { status: 400 },
    );
  }

  const body = ((await request.json().catch(() => null)) ?? {}) as { enabled?: unknown };
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled (boolean) is required." }, { status: 400 });
  }

  await setSmartsheetApiEnabled(body.enabled);
  await auditFromPrincipal(
    auth.principal ? adminPrincipalToPrincipal(auth.principal) : null,
    body.enabled ? "smartsheet_api.enable" : "smartsheet_api.disable",
    "app_settings",
    "smartsheet_api_enabled",
    { enabled: body.enabled },
  );

  return NextResponse.json({
    enabled: body.enabled,
    databaseConfigured: true,
    canToggle: true,
  });
}
