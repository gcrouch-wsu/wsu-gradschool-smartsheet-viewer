import { config } from "@/lib/forms/config";
import * as ss from "@/lib/forms/smartsheet-api";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAdminAccess } from "@/lib/forms/forms-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sightId: string }> },
) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  const { sightId } = await params;
  await ensureBootstrapped();

  try {
    const dashboard = await ss.getSight(sightId);
    return Response.json({ dashboard, demo: config.demo });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
