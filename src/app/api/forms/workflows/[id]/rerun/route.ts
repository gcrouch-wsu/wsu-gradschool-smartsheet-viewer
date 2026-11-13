import { recordAuditEvent } from "@/lib/audit";
import { formsAuthErrorResponse, requireWorkflowAuthorAccess } from "@/lib/forms/forms-api";
import { isFormsDatabaseEnabled } from "@/lib/forms/db";
import * as ss from "@/lib/forms/smartsheet-api";
import { performWorkflowAction } from "@/lib/workflows/execute-action";
import { getWorkflow, insertWorkflowRun } from "@/lib/workflows/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkflowAuthorAccess();
  if ("response" in access) return access.response;
  if (!isFormsDatabaseEnabled()) {
    return Response.json({ error: "Workflows need Postgres (DATABASE_URL)." }, { status: 503 });
  }
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { rowId?: string | number };
  const rowId = body.rowId;
  if (rowId == null || String(rowId).trim() === "") {
    return Response.json({ error: "A row is required to run this workflow again." }, { status: 400 });
  }
  try {
    const workflow = await getWorkflow(id);
    if (!workflow) return Response.json({ error: "Workflow not found." }, { status: 404 });
    if (!workflow.enabled) return Response.json({ error: "Enable the workflow before running it again." }, { status: 400 });
    const raw = (await ss.getRow(workflow.sheetId, rowId)) as {
      cells?: Array<{ columnId: number; value?: unknown; displayValue?: unknown; objectValue?: unknown }>;
    };
    const run = await insertWorkflowRun({
      workflowId: workflow.id,
      sheetId: workflow.sheetId,
      rowId,
      eventKey: `manual:${rowId}:${Date.now()}`,
      status: "pending",
      source: "manual",
    });
    if (!run) return Response.json({ error: "Could not start a run." }, { status: 500 });
    await performWorkflowAction({
      workflow,
      runId: run.id,
      attemptCount: run.attemptCount,
      rowId,
      cells: raw.cells ?? [],
    });
    await recordAuditEvent({
      actorKind: "admin",
      actorId: access.user.email,
      actorLabel: access.user.name,
      action: "workflow.rerun",
      resourceType: "workflow",
      resourceId: workflow.id,
      metadata: { rowId: String(rowId), runId: run.id },
    });
    return Response.json({ ok: true, runId: run.id });
  } catch (error) {
    return formsAuthErrorResponse(error);
  }
}
