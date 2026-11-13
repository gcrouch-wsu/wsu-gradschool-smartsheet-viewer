import { recordAuditEvent } from "@/lib/audit";
import { formsAuthErrorResponse } from "@/lib/forms/forms-api";
import { isFormsDatabaseEnabled } from "@/lib/forms/db";
import { resolvePrincipal } from "@/lib/identity";
import { completeApproval } from "@/lib/workflows/execute-action";
import { normalizeEmail } from "@/lib/workflows/recipients";
import { getWorkflow, getWorkflowRun, listRunDeliveries } from "@/lib/workflows/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const principal = await resolvePrincipal(request);
  if (!principal) return Response.json({ message: "Sign in required." }, { status: 401 });
  if (!isFormsDatabaseEnabled()) {
    return Response.json({ error: "Workflows need Postgres (DATABASE_URL)." }, { status: 503 });
  }
  const email = normalizeEmail(principal.email || principal.identifier);
  if (!email) return Response.json({ error: "This account has no email address." }, { status: 400 });

  const { runId } = await params;
  const body = (await request.json().catch(() => ({}))) as { decision?: string; comment?: string };
  const decision = body.decision === "approved" || body.decision === "declined" ? body.decision : null;
  if (!decision) return Response.json({ error: "Choose approve or decline." }, { status: 400 });

  try {
    const run = await getWorkflowRun(runId);
    if (!run) return Response.json({ error: "Run not found." }, { status: 404 });
    if (run.status !== "waiting") {
      return Response.json({ error: "This request is no longer waiting for a decision." }, { status: 409 });
    }
    const workflow = await getWorkflow(run.workflowId);
    if (!workflow) return Response.json({ error: "Workflow not found." }, { status: 404 });
    const deliveries = await listRunDeliveries([run.id]);
    const allowed = deliveries.some((delivery) => delivery.recipientEmail === email && delivery.channel === "in_app");
    if (!allowed) return Response.json({ error: "You are not an approver for this request." }, { status: 403 });
    await completeApproval({
      runId: run.id,
      workflow,
      rowId: run.rowId,
      decision,
      decidedBy: email,
      comment: body.comment,
    });
    await recordAuditEvent({
      actorKind: "admin",
      actorId: email,
      actorLabel: principal.displayName,
      action: "workflow.decision",
      resourceType: "workflow_run",
      resourceId: run.id,
      metadata: { decision },
    });
    return Response.json({ ok: true, decision });
  } catch (error) {
    return formsAuthErrorResponse(error);
  }
}
