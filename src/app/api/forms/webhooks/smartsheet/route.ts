import * as registry from "@/lib/forms/registry";
import { recordWebhookEvent } from "@/lib/forms/sync-state";
import { ensureBootstrapped } from "@/lib/forms/init";
import { validateWebhookSecret } from "@/lib/forms/webhook-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!validateWebhookSecret(request)) {
    return Response.json({ message: "Invalid webhook secret." }, { status: 401 });
  }

  await ensureBootstrapped();
  const body = await request.json().catch(() => ({}));

  if (body.challenge) {
    return Response.json({ smartsheetHookResponse: body.challenge });
  }

  const events = body.events ?? body.data ?? [];
  const active = await registry.activeSheetId();

  for (const ev of Array.isArray(events) ? events : [events]) {
    const sheetId = ev.objectId ?? ev.sheetId ?? Number(active);
    await recordWebhookEvent(Number(sheetId), String(ev.eventType ?? ev.type ?? "unknown"), Number(ev.rowId ?? ev.id ?? 0));
  }

  return Response.json({ ok: true });
}
