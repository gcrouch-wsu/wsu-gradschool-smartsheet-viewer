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
    const columns = await ss.listColumns(sheetId);
    return Response.json({ columns, demo: config.demo });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sheetId: string }> },
) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  const { sheetId } = await params;
  await ensureBootstrapped();

  const body = await request.json().catch(() => ({}));
  const columns = body.columns ?? [body];
  if (!Array.isArray(columns) || !columns.length) {
    return Response.json({ error: "columns array is required." }, { status: 400 });
  }

  try {
    const result = await ss.addColumns(sheetId, columns, body.index);
    return Response.json({ ok: true, result, demo: config.demo });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
