import { config } from "@/lib/forms/config";
import * as ss from "@/lib/forms/smartsheet-api";
import * as registry from "@/lib/forms/registry";
import { buildSheetView } from "@/lib/forms/sheet-view";
import { buildSubmissions } from "@/lib/forms/tracker";
import { resolveFormColumns } from "@/lib/forms/form-fields";
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
    const view = await buildSheetView(sheet);
    const submissions = await buildSubmissions(sheet);
    const approvalByRow = new Map(submissions.map((s) => [s.rowId, s.approvalStatus]));
    const rows = view.rows.map((row) => ({
      ...row,
      approvalStatus: approvalByRow.get(row.id) ?? null,
    }));
    const wf = await resolveWorkflow(sheet);
    const { columns: formCols, source: formColumnSource } = await resolveFormColumns(sheet, ss.extractColumns(sheet));
    const formColumnIds = formCols.map((c) => c.id);
    return Response.json({
      sheetId: active,
      sheetName: sheet.name,
      demo: config.demo,
      totalRowCount: sheet.totalRowCount ?? view.rows.length,
      formColumnIds,
      formColumnSource,
      ...view,
      rows,
      workflow: {
        ...view.workflow,
        approvedValues: wf.approvedValues,
        declinedValues: wf.declinedValues,
      },
    });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
