import { config } from "@/lib/forms/config";
import * as ss from "@/lib/forms/smartsheet-api";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAdminAccess } from "@/lib/forms/forms-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  try {
    await ensureBootstrapped();
    const sheets = await ss.listSheets();
    return Response.json({ sheets, defaultTemplateId: config.templateSheetId, demo: config.demo });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
