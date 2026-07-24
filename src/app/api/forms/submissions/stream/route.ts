import { config } from "@/lib/forms/config";
import * as registry from "@/lib/forms/registry";
import { buildSubmissions } from "@/lib/forms/tracker";
import * as ss from "@/lib/forms/smartsheet-api";
import { getSyncState } from "@/lib/forms/sync-state";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAccess } from "@/lib/forms/forms-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lightweight polling endpoint for tracker auto-refresh. */
export async function GET(request: Request) {
  const access = await requireFormsAccess(request);
  if ("response" in access) return access.response;

  await ensureBootstrapped();
  const active = await registry.activeSheetId();
  if (!active) return Response.json({ error: "No form selected yet." }, { status: 409 });

  const since = new URL(request.url).searchParams.get("since") ?? "";
  const state = await getSyncState();

  try {
    const sheet = await ss.getSheet(active);
    const payload = {
      submissions: await buildSubmissions(sheet),
      sheetName: sheet.name,
      lastWebhookAt: state.lastWebhookAt ?? null,
      recentEvents: since
        ? state.recentEvents.filter((e) => e.at > since)
        : state.recentEvents.slice(0, 5),
      demo: config.demo,
      at: new Date().toISOString(),
    };
    return Response.json(payload);
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
