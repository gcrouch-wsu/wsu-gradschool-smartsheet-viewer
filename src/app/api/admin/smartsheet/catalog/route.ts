import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/admin-api";
import {
  extractSmartsheetErrorMessage,
  listSmartsheetCatalog,
  SmartsheetRequestError,
} from "@/lib/smartsheet";
import { isSmartsheetApiEnabled } from "@/lib/smartsheet-api-gate";
import {
  listImportedReportSummaries,
  listImportedSheetSummaries,
} from "@/lib/local-sheets/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminApiAccess();
  if (auth.response) {
    return auth.response;
  }

  const url = new URL(request.url);
  const typeParam = (url.searchParams.get("type") ?? "sheet").trim().toLowerCase();
  if (typeParam !== "sheet" && typeParam !== "report") {
    return NextResponse.json({ error: 'Query param "type" must be "sheet" or "report".' }, { status: 400 });
  }

  if (!(await isSmartsheetApiEnabled())) {
    const items =
      typeParam === "report"
        ? await listImportedReportSummaries()
        : await listImportedSheetSummaries();
    return NextResponse.json({ type: typeParam, items, source: "local" });
  }

  const connectionKey = url.searchParams.get("connectionKey")?.trim() || undefined;
  const apiBaseUrl = url.searchParams.get("apiBaseUrl")?.trim() || undefined;

  try {
    const items = await listSmartsheetCatalog(typeParam, { connectionKey, apiBaseUrl });
    return NextResponse.json({ type: typeParam, items, source: "smartsheet" });
  } catch (error) {
    if (error instanceof SmartsheetRequestError) {
      return NextResponse.json(
        { error: extractSmartsheetErrorMessage(error.body) || error.message },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to list Smartsheet resources." },
      { status: 502 },
    );
  }
}
