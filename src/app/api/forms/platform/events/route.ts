import { config } from "@/lib/forms/config";
import * as ss from "@/lib/forms/smartsheet-api";
import { getSyncState, setLastEventId } from "@/lib/forms/sync-state";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAdminAccess } from "@/lib/forms/forms-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  await ensureBootstrapped();

  const state = await getSyncState();
  const since = new URL(request.url).searchParams.get("since") ?? state.lastEventId;

  try {
    const events = (await ss.listEvents(since ?? undefined)) as { lastEventId?: string | number };
    if (events.lastEventId) await setLastEventId(String(events.lastEventId));
    return Response.json({ events, demo: config.demo });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
