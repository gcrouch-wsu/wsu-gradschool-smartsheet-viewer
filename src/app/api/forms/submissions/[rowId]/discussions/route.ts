import { config } from "@/lib/forms/config";
import * as ss from "@/lib/forms/smartsheet-api";
import { ensureBootstrapped } from "@/lib/forms/init";
import {
  formsAuthErrorResponse,
  requireFormsAccess,
  requireFormsApproverAccess,
} from "@/lib/forms/forms-api";
import {
  resolveFormsSheetId,
  sheetIdFromRequest,
  sheetIdFromRequestOrBody,
} from "@/lib/forms/sheet-access";

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
    const discussions = await ss.listDiscussions(sheetId, rowId);
    return Response.json({ sheetId, discussions, demo: config.demo });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ rowId: string }> },
) {
  const access = await requireFormsApproverAccess(request);
  if ("response" in access) return access.response;

  const { rowId } = await params;
  await ensureBootstrapped();

  const body = await request.json().catch(() => ({}));
  const resolved = await resolveFormsSheetId(sheetIdFromRequestOrBody(request, body));
  if (!resolved.ok) {
    return Response.json({ error: resolved.error }, { status: resolved.status });
  }
  const sheetId = resolved.sheetId;

  const text = String(body.text ?? "").trim();
  if (!text) return Response.json({ error: "text is required." }, { status: 400 });

  try {
    const result = await ss.addDiscussion(sheetId, rowId, text);
    return Response.json({ ok: true, sheetId, result, demo: config.demo });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
