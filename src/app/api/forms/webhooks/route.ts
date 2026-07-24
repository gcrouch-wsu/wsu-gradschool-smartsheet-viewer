import { config } from "@/lib/forms/config";
import * as ss from "@/lib/forms/smartsheet-api";
import * as registry from "@/lib/forms/registry";
import {
  ensureWebhookSecret,
  getSyncState,
  setWebhookRegistration,
} from "@/lib/forms/sync-state";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAdminAccess } from "@/lib/forms/forms-api";
import { FORM_WEBHOOK_SECRET_ENV_VAR } from "@/lib/forms/webhook-auth";
import { buildCallbackUrl, maskCallbackUrl } from "@/lib/forms/webhook-callback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SmartsheetWebhook = {
  id?: number;
  name?: string;
  enabled?: boolean;
  status?: string;
  callbackUrl?: string;
  scope?: string;
  scopeObjectId?: number;
};

function adminStateView(state: Awaited<ReturnType<typeof getSyncState>>) {
  const envSecret = Boolean(process.env[FORM_WEBHOOK_SECRET_ENV_VAR]?.trim());
  return {
    lastWebhookAt: state.lastWebhookAt ?? null,
    webhookId: state.webhookId ?? null,
    sheetId: state.sheetId ?? null,
    callbackUrl: state.callbackUrl ? maskCallbackUrl(state.callbackUrl) : null,
    secretConfigured: envSecret || Boolean(state.webhookSecret?.trim()),
    secretSource: envSecret ? ("env" as const) : state.webhookSecret?.trim() ? ("stored" as const) : ("none" as const),
  };
}

function normalizeWebhook(
  raw: unknown,
  formNameBySheetId: Map<string, string>,
): {
  id: number | null;
  name: string;
  enabled: boolean;
  status: string | null;
  sheetId: string | null;
  sheetName: string | null;
  callbackUrl: string | null;
  isFormsWebhook: boolean;
} {
  const wh = (raw && typeof raw === "object" ? raw : {}) as SmartsheetWebhook;
  const sheetId = wh.scopeObjectId != null ? String(wh.scopeObjectId) : null;
  const callbackUrl = typeof wh.callbackUrl === "string" ? wh.callbackUrl : null;
  const isFormsWebhook = Boolean(
    callbackUrl && callbackUrl.includes("/api/forms/webhooks/smartsheet"),
  );
  return {
    id: typeof wh.id === "number" ? wh.id : wh.id != null ? Number(wh.id) : null,
    name: typeof wh.name === "string" && wh.name.trim() ? wh.name : "Webhook",
    enabled: Boolean(wh.enabled),
    status: typeof wh.status === "string" ? wh.status : null,
    sheetId,
    sheetName: sheetId ? formNameBySheetId.get(sheetId) ?? null : null,
    callbackUrl: callbackUrl ? maskCallbackUrl(callbackUrl) : null,
    isFormsWebhook,
  };
}

export async function GET() {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  await ensureBootstrapped();

  try {
    const [webhooksRaw, state, forms, activeSheetId] = await Promise.all([
      ss.listWebhooks(),
      getSyncState(),
      registry.listForms(),
      registry.activeSheetId(),
    ]);
    const formNameBySheetId = new Map(forms.map((f) => [String(f.id), f.name]));
    const webhooks = (Array.isArray(webhooksRaw) ? webhooksRaw : []).map((w) =>
      normalizeWebhook(w, formNameBySheetId),
    );
    const active = activeSheetId
      ? {
          sheetId: activeSheetId,
          sheetName: formNameBySheetId.get(activeSheetId) ?? null,
          hasWebhook: webhooks.some((w) => w.sheetId === activeSheetId && w.isFormsWebhook),
          enabledWebhook: webhooks.some(
            (w) => w.sheetId === activeSheetId && w.isFormsWebhook && w.enabled,
          ),
        }
      : null;

    return Response.json({
      webhooks,
      active,
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
      try {
        await ss.updateWebhook(webhookId, true);
      } catch {
        // Challenge handshake may still be pending; webhook remains registered but disabled.
      }
    }
    await setWebhookRegistration({
      webhookId,
      sheetId: targetSheetId,
      callbackUrl,
    });
    const state = await getSyncState();
    return Response.json({
      ok: true,
      result,
      sheetId: targetSheetId,
      sheetName: registered.name,
      callbackUrl: maskCallbackUrl(callbackUrl),
      state: adminStateView(state),
      demo: config.demo,
    });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
