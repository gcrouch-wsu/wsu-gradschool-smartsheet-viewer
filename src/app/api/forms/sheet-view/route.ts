import { config } from "@/lib/forms/config";
import * as ss from "@/lib/forms/smartsheet-api";
import { buildSheetView } from "@/lib/forms/sheet-view";
import { buildSubmissions } from "@/lib/forms/tracker";
import { resolveFormColumns } from "@/lib/forms/form-fields";
import { resolveWorkflow } from "@/lib/forms/workflow";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAccess } from "@/lib/forms/forms-api";
import { resolveFormsSheetId, sheetIdFromRequest } from "@/lib/forms/sheet-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireFormsAccess(request);
  if ("response" in access) return access.response;

  await ensureBootstrapped();
  const resolved = await resolveFormsSheetId(sheetIdFromRequest(request));
  if (!resolved.ok) {
    return Response.json({ error: resolved.error }, { status: resolved.status });
  }
  const sheetId = resolved.sheetId;

  try {
    const sheet = await ss.getSheet(sheetId);
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
      sheetId,
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
