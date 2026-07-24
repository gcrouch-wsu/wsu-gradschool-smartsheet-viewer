import { config } from "@/lib/forms/config";
import * as ss from "@/lib/forms/smartsheet-api";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAdminAccess } from "@/lib/forms/forms-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sheetId: string }> },
) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  const { sheetId } = await params;
  await ensureBootstrapped();

  try {
    const forms = await ss.listForms(sheetId);
    return Response.json({ forms, demo: config.demo });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
