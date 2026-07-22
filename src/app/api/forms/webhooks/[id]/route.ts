import { config } from "@/lib/forms/config";
import * as ss from "@/lib/forms/smartsheet-api";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAdminAccess } from "@/lib/forms/forms-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  await ensureBootstrapped();

  const { id } = await params;
  const webhookId = Number(id);
  if (!Number.isFinite(webhookId) || webhookId <= 0) {
    return Response.json({ error: "Invalid webhook id." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  if (typeof body.enabled !== "boolean") {
    return Response.json({ error: "enabled must be true or false." }, { status: 400 });
  }

  try {
    const result = await ss.updateWebhook(webhookId, body.enabled);
    return Response.json({
      ok: true,
      webhookId,
      enabled: body.enabled,
      result,
      demo: config.demo,
    });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
