import { config } from "@/lib/forms/config";
import * as ss from "@/lib/forms/smartsheet-api";
import * as registry from "@/lib/forms/registry";
import { buildSubmissions } from "@/lib/forms/tracker";
import { resolveWorkflow } from "@/lib/forms/workflow";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAccess } from "@/lib/forms/forms-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireFormsAccess(request);
  if ("response" in access) return access.response;

  await ensureBootstrapped();
  const active = await registry.activeSheetId();
  if (!active) return Response.json({ error: "No form selected yet." }, { status: 409 });

  try {
    const sheet = await ss.getSheet(active);
    const wf = await resolveWorkflow(sheet);
    return Response.json({
      sheetName: sheet.name,
      stages: wf.approvalStages,
      workflowSource: wf.source,
      overallColumn: wf.overallColumn,
      submissions: await buildSubmissions(sheet),
      demo: config.demo,
      roles: access.user.roles,
    });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
