import * as registry from "@/lib/forms/registry";
import { recordWebhookEvent } from "@/lib/forms/sync-state";
import { ensureBootstrapped } from "@/lib/forms/init";
import { validateWebhookSecret } from "@/lib/forms/webhook-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await validateWebhookSecret(request))) {
    return Response.json({ message: "Invalid webhook secret." }, { status: 401 });
  }

  await ensureBootstrapped();
  const body = await request.json().catch(() => ({}));

  if (body.challenge) {
    return Response.json({ smartsheetHookResponse: body.challenge });
  }

  const events = body.events ?? body.data ?? [];
  const active = await registry.activeSheetId();
  const scopeSheetId = Number(body.scopeObjectId ?? active);
  const list = Array.isArray(events) ? events : [events];

  for (const ev of list) {
    if (!ev || typeof ev !== "object") continue;
    const sheetId = Number(
      (ev as { sheetId?: unknown }).sheetId ??
        (ev as { scopeObjectId?: unknown }).scopeObjectId ??
        scopeSheetId,
    );
    if (!Number.isFinite(sheetId) || sheetId <= 0) continue;
    const eventType = String(
      (ev as { eventType?: unknown }).eventType ?? (ev as { type?: unknown }).type ?? "unknown",
    );
    const objectId = Number(
      (ev as { id?: unknown }).id ?? (ev as { rowId?: unknown }).rowId ?? (ev as { objectId?: unknown }).objectId ?? 0,
    );
    await recordWebhookEvent(sheetId, eventType, Number.isFinite(objectId) ? objectId : 0);
  }

  return Response.json({ ok: true });
}
