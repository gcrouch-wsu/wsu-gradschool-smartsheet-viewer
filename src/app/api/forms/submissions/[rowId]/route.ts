import { config } from "@/lib/forms/config";
import * as ss from "@/lib/forms/smartsheet-api";
import * as registry from "@/lib/forms/registry";
import { buildSubmissions } from "@/lib/forms/tracker";
import {
  findCurrentStage,
  validateWorkflowValue,
  approvedValue,
  declinedValue,
} from "@/lib/forms/submission-actions";
import { resolveWorkflow } from "@/lib/forms/workflow";
import { rateLimit } from "@/lib/forms/rate-limit";
import { ensureBootstrapped } from "@/lib/forms/init";
import {
  formsAuthErrorResponse,
  requireFormsAccess,
  requireFormsAdminAccess,
  requireFormsApproverAccess,
} from "@/lib/forms/forms-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ rowId: string }> },
) {
  const access = await requireFormsAccess(request);
  if ("response" in access) return access.response;

  const { rowId } = await params;
  await ensureBootstrapped();
  const active = await registry.activeSheetId();
  if (!active) return Response.json({ error: "No form selected yet." }, { status: 409 });

  try {
    const sheet = await ss.getSheet(active);
    const row = await ss.getRow(active, rowId);
    const submissions = await buildSubmissions({ ...sheet, rows: [row] });
    return Response.json({
      submission: submissions[0] ?? null,
      row,
      demo: config.demo,
      roles: access.user.roles,
    });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ rowId: string }> },
) {
  const access = await requireFormsApproverAccess(request);
  if ("response" in access) return access.response;

  const { rowId } = await params;
  await ensureBootstrapped();

  if (!(await rateLimit("patch:submission"))) {
    return Response.json({ error: "Too many updates. Please wait a minute." }, { status: 429 });
  }

  const active = await registry.activeSheetId();
  if (!active) return Response.json({ error: "No form selected yet." }, { status: 409 });

  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "").toLowerCase();
  const columnTitle = body.columnTitle ? String(body.columnTitle) : "";
  const customValue = body.value !== undefined ? String(body.value) : "";

  if (!["approve", "decline", "set"].includes(action)) {
    return Response.json({ error: "action must be approve, decline, or set." }, { status: 400 });
  }

  try {
    const sheet = await ss.getSheet(active);
    const wf = await resolveWorkflow(sheet);
    const rowIdNum = Number(rowId);
    let targetColumn = columnTitle;
    let value = customValue;

    if (action === "approve" || action === "decline") {
      const current = await findCurrentStage(sheet, rowIdNum);
      if (!current) return Response.json({ error: "No actionable stage for this submission." }, { status: 409 });
      targetColumn = current.name;
      value = action === "approve" ? await approvedValue(sheet) : await declinedValue(sheet);
    }

    const err = await validateWorkflowValue(sheet, targetColumn, value);
    if (err) return Response.json({ error: err }, { status: 422 });

    const columns = (sheet.columns ?? []) as { title?: string; id: number }[];
    const col = columns.find((c) => String(c.title).toLowerCase() === targetColumn.toLowerCase());
    if (!col) return Response.json({ error: "Column not found." }, { status: 422 });
    const cells: { columnId: number; value: string }[] = [{ columnId: col.id, value }];

    if (action === "decline" && wf.overallColumn) {
      const overallCol = columns.find((c) => String(c.title).toLowerCase() === wf.overallColumn.toLowerCase());
      if (overallCol) cells.push({ columnId: overallCol.id, value: await declinedValue(sheet) });
    }

    if (action === "approve") {
      const stages = wf.approvalStages;
      const idx = stages.findIndex((s) => s.toLowerCase() === targetColumn.toLowerCase());
      const allApproved = idx === stages.length - 1;
      if (allApproved && wf.overallColumn) {
        const overallCol = columns.find((c) => String(c.title).toLowerCase() === wf.overallColumn.toLowerCase());
        if (overallCol) cells.push({ columnId: overallCol.id, value: "Complete" });
      }
    }

    await ss.updateRows(active, [{ id: rowIdNum, cells }]);
    return Response.json({ ok: true, columnTitle: targetColumn, value, demo: config.demo });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ rowId: string }> },
) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  const { rowId } = await params;
  await ensureBootstrapped();

  const active = await registry.activeSheetId();
  if (!active) return Response.json({ error: "No form selected yet." }, { status: 409 });

  try {
    await ss.deleteRows(active, [rowId]);
    return Response.json({ ok: true, rowId, demo: config.demo });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
