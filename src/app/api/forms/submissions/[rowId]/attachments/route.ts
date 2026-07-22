import * as ss from "@/lib/forms/smartsheet-api";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAccess } from "@/lib/forms/forms-api";
import { resolveFormsSheetId, sheetIdFromRequest } from "@/lib/forms/sheet-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ rowId: string }> },
) {
  const access = await requireFormsAccess(request);
  if ("response" in access) return access.response;

  const { rowId } = await params;
  await ensureBootstrapped();
  const resolved = await resolveFormsSheetId(sheetIdFromRequest(request));
  if (!resolved.ok) {
    return Response.json({ error: resolved.error }, { status: resolved.status });
  }
  const sheetId = resolved.sheetId;

  try {
    const attachments = await ss.listAttachments(sheetId, rowId);
    return Response.json({ sheetId, attachments });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
