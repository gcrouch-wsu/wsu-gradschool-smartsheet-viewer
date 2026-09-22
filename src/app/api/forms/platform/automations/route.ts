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
        "Only single-action rules are shown. Multi-step or conditional workflows and Slack notifications are not returned by the API — view those in Smartsheet. Requires a Business/Enterprise plan. Turning rules off here disables them; it does not delete them.",
    });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}

type Rule = { id?: number | string; enabled?: boolean; name?: string };

/** Disable or re-enable every API-visible rule on the active sheet. Never deletes rules. */
export async function PATCH(request: Request) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  await ensureBootstrapped();
  const active = await registry.activeSheetId();
  if (!active) return Response.json({ error: "No form selected yet." }, { status: 409 });

  const body = (await request.json().catch(() => ({}))) as { enabled?: unknown };
  if (typeof body.enabled !== "boolean") {
    return Response.json({ error: "enabled must be true or false." }, { status: 400 });
  }

  try {
    const rules = (await ss.listAutomationRules(active)) as Rule[];
    const updated: Rule[] = [];
    const skipped: Array<{ name?: string; reason: string }> = [];
    for (const rule of rules) {
      if (rule.id == null) {
        skipped.push({
          name: rule.name,
          reason: "This rule has no id in the Smartsheet API. Turn it off in Smartsheet if it is a multi-step workflow.",
        });
        continue;
      }
      try {
        const result = (await ss.updateAutomationRule(active, rule.id, body.enabled)) as Rule;
        updated.push(result);
      } catch (error) {
        skipped.push({
          name: rule.name,
          reason: error instanceof Error ? error.message : "Could not update this rule.",
        });
      }
    }
    return Response.json({
      enabled: body.enabled,
      updated,
      skipped,
      notice:
        skipped.length > 0
          ? "Some rules could not be changed from this app. Multi-step or approval workflows may need a one-time change in Smartsheet."
          : undefined,
    });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
