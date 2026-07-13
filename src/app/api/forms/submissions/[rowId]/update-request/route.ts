import { config } from "@/lib/forms/config";
import * as ss from "@/lib/forms/smartsheet-api";
import * as registry from "@/lib/forms/registry";
import { stageColumns } from "@/lib/forms/tracker";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAdminAccess } from "@/lib/forms/forms-api";

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

  const active = await registry.activeSheetId();
  if (!active) return Response.json({ error: "No form selected yet." }, { status: 409 });

  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim();
  const message = body.message ? String(body.message) : undefined;
  if (!email) return Response.json({ error: "email is required." }, { status: 400 });

  try {
    const sheet = await ss.getSheet(active);
    const stages = await stageColumns(sheet);
    const columnIds = stages.map((s) => s.columnId);
    const result = await ss.sendUpdateRequest(active, {
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
