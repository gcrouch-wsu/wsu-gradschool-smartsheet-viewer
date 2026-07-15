import { config } from "@/lib/forms/config";
import * as ss from "@/lib/forms/smartsheet-api";
import * as registry from "@/lib/forms/registry";
import { getSyncState, setWebhookId } from "@/lib/forms/sync-state";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAdminAccess } from "@/lib/forms/forms-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  await ensureBootstrapped();

  try {
    const webhooks = await ss.listWebhooks();
    const state = await getSyncState();
    return Response.json({ webhooks, state, demo: config.demo });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}

export async function POST(request: Request) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  await ensureBootstrapped();

  const body = await request.json().catch(() => ({}));
  const requestedSheetId = body.sheetId != null ? String(body.sheetId).trim() : "";
  const active = await registry.activeSheetId();
  const targetSheetId = requestedSheetId || active;
  if (!targetSheetId) return Response.json({ error: "No form selected yet." }, { status: 409 });

  const registered = await registry.getFormById(targetSheetId);
  if (!registered) {
    return Response.json({ error: "Sheet is not in the forms registry." }, { status: 404 });
  }

  const callbackUrl = String(body.callbackUrl ?? config.webhookCallbackUrl).trim();
  if (!callbackUrl) {
    return Response.json({ error: "callbackUrl or WEBHOOK_CALLBACK_URL is required." }, { status: 400 });
  }

  try {
    const result = (await ss.createWebhook(callbackUrl, Number(targetSheetId), ["*.*"])) as { result?: { id?: number } };
    if (result.result?.id) await setWebhookId(result.result.id);
    return Response.json({ ok: true, result, sheetId: targetSheetId, demo: config.demo });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
