import { config } from "@/lib/forms/config";
import * as ss from "@/lib/forms/smartsheet-api";
import * as registry from "@/lib/forms/registry";
import {
  ensureWebhookSecret,
  getSyncState,
  setWebhookCallbackUrl,
  setWebhookId,
} from "@/lib/forms/sync-state";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAdminAccess } from "@/lib/forms/forms-api";
import { FORM_WEBHOOK_SECRET_ENV_VAR } from "@/lib/forms/webhook-auth";
import { buildCallbackUrl, maskCallbackUrl } from "@/lib/forms/webhook-callback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function adminStateView(state: Awaited<ReturnType<typeof getSyncState>>) {
  const envSecret = Boolean(process.env[FORM_WEBHOOK_SECRET_ENV_VAR]?.trim());
  return {
    lastWebhookAt: state.lastWebhookAt ?? null,
    webhookId: state.webhookId ?? null,
    callbackUrl: state.callbackUrl ? maskCallbackUrl(state.callbackUrl) : null,
    secretConfigured: envSecret || Boolean(state.webhookSecret?.trim()),
    secretSource: envSecret ? ("env" as const) : state.webhookSecret?.trim() ? ("stored" as const) : ("none" as const),
  };
}

export async function GET() {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  await ensureBootstrapped();

  try {
    const webhooks = await ss.listWebhooks();
    const state = await getSyncState();
    return Response.json({
      webhooks,
      state: adminStateView(state),
      demo: config.demo,
    });
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

  const secret = await ensureWebhookSecret();
  const resolved = buildCallbackUrl(request, secret);
  if ("error" in resolved) {
    return Response.json({ error: resolved.error }, { status: 400 });
  }
  const callbackUrl = resolved.url;

  try {
    const result = (await ss.createWebhook(callbackUrl, Number(targetSheetId), ["*.*"])) as {
      result?: { id?: number };
    };
    const webhookId = result.result?.id;
    if (webhookId) {
      await setWebhookId(webhookId);
      try {
        await ss.updateWebhook(webhookId, true);
      } catch {
        // Challenge handshake may still be pending; webhook remains registered but disabled.
      }
    }
    await setWebhookCallbackUrl(callbackUrl);
    const state = await getSyncState();
    return Response.json({
      ok: true,
      result,
      sheetId: targetSheetId,
      callbackUrl: maskCallbackUrl(callbackUrl),
      state: adminStateView(state),
      demo: config.demo,
    });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
