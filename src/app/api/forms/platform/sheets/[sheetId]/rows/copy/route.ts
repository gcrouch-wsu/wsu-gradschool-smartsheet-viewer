import { config } from "@/lib/forms/config";
import * as ss from "@/lib/forms/smartsheet-api";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAdminAccess } from "@/lib/forms/forms-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sheetId: string }> },
) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  const { sheetId } = await params;
  await ensureBootstrapped();

  const body = await request.json().catch(() => ({}));
  const rowIds = (body.rowIds ?? []).map(Number);
  const toSheetId = Number(body.toSheetId);
  if (!rowIds.length || !toSheetId) {
    return Response.json({ error: "rowIds and toSheetId are required." }, { status: 400 });
  }

  try {
    const result = await ss.copyRows(sheetId, rowIds, toSheetId, body.include);
    return Response.json({ ok: true, result, demo: config.demo });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
