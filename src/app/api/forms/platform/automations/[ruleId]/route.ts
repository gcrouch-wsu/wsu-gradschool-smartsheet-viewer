import * as ss from "@/lib/forms/smartsheet-api";
import * as registry from "@/lib/forms/registry";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAdminAccess } from "@/lib/forms/forms-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ ruleId: string }> },
) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  await ensureBootstrapped();
  const active = await registry.activeSheetId();
  if (!active) return Response.json({ error: "No form selected yet." }, { status: 409 });

  const { ruleId } = await params;
  const body = (await request.json().catch(() => ({}))) as { enabled?: unknown };
  if (typeof body.enabled !== "boolean") {
    return Response.json({ error: "enabled must be true or false." }, { status: 400 });
  }

  try {
    const result = await ss.updateAutomationRule(active, ruleId, body.enabled);
    return Response.json({ rule: result, enabled: body.enabled });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
