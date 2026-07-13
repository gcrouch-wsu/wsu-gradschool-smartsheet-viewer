import { config } from "@/lib/forms/config";
import * as ss from "@/lib/forms/smartsheet-api";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAdminAccess } from "@/lib/forms/forms-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ sheetId: string; columnId: string }> },
) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  const { sheetId, columnId } = await params;
  await ensureBootstrapped();

  const body = await request.json().catch(() => ({}));
  try {
    const result = await ss.updateColumn(sheetId, Number(columnId), body);
    return Response.json({ ok: true, result, demo: config.demo });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sheetId: string; columnId: string }> },
) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  const { sheetId, columnId } = await params;
  await ensureBootstrapped();

  try {
    await ss.deleteColumn(sheetId, Number(columnId));
    return Response.json({ ok: true, demo: config.demo });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
