import * as ss from "@/lib/forms/smartsheet-api";
import * as registry from "@/lib/forms/registry";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAdminAccess } from "@/lib/forms/forms-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  await ensureBootstrapped();
  const active = await registry.activeSheetId();
  if (!active) return Response.json({ error: "No form selected yet." }, { status: 409 });

  try {
    const rules = await ss.listAutomationRules(active);
    return Response.json({
      rules,
      notice:
        "Only single-action rules are shown. Multi-step or conditional workflows and Slack notifications are not returned by the API — view those in Smartsheet. Requires a Business/Enterprise plan.",
    });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
