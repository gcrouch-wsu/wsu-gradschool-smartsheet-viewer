import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/admin-api";
import { auditFromPrincipal } from "@/lib/audit";
import { isDatabaseConfigEnabled } from "@/lib/config/config-db";
import { adminPrincipalToPrincipal } from "@/lib/identity";
import { importSmartsheetData, type ImportScope } from "@/lib/local-sheets/import";
import { isSmartsheetApiEnabled } from "@/lib/smartsheet-api-gate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function parseScope(value: unknown): ImportScope {
  return value === "all" ? "all" : "registered";
}

export async function POST(request: Request) {
  const auth = await requireAdminApiAccess();
  if (auth.response) {
    return auth.response;
  }

  if (!isDatabaseConfigEnabled()) {
    return NextResponse.json(
      { error: "DATABASE_URL is required to import Smartsheet data." },
      { status: 400 },
    );
  }

  if (!(await isSmartsheetApiEnabled())) {
    return NextResponse.json(
      {
        error:
          "Turn the Smartsheet API on temporarily to run the import. After it finishes, you can turn the API off and use the imported copy.",
      },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { scope?: unknown };
  const scope = parseScope(body.scope);

  try {
    const summary = await importSmartsheetData(scope);
    await auditFromPrincipal(
      auth.principal ? adminPrincipalToPrincipal(auth.principal) : null,
      "smartsheet.import",
      "sheets",
      scope,
      summary as unknown as Record<string, unknown>,
    );
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed." },
      { status: 500 },
    );
  }
}
