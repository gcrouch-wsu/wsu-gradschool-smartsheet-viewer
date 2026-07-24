import { config } from "@/lib/forms/config";
import * as ss from "@/lib/forms/smartsheet-api";
import { stageColumns } from "@/lib/forms/tracker";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAdminAccess } from "@/lib/forms/forms-api";
import { resolveFormsSheetId, sheetIdFromRequestOrBody } from "@/lib/forms/sheet-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ rowId: string }> },
) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  const { rowId } = await params;
  await ensureBootstrapped();

  const body = await request.json().catch(() => ({}));
  const resolved = await resolveFormsSheetId(sheetIdFromRequestOrBody(request, body));
  if (!resolved.ok) {
    return Response.json({ error: resolved.error }, { status: resolved.status });
  }
  const sheetId = resolved.sheetId;

  const email = String(body.email ?? "").trim();
  const message = body.message ? String(body.message) : undefined;
  if (!email) return Response.json({ error: "email is required." }, { status: 400 });

  try {
    const sheet = await ss.getSheet(sheetId);
    const stages = await stageColumns(sheet);
    const columnIds = stages.map((s) => s.columnId);
    const result = await ss.sendUpdateRequest(sheetId, {
      rowIds: [Number(rowId)],
      columnIds,
      message,
      sendTo: [{ email }],
    });
    return Response.json({ ok: true, result, demo: config.demo });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
