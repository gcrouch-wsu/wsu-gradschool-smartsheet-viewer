import { formsAuthErrorResponse, requireWorkflowAuthorAccess } from "@/lib/forms/forms-api";
import { isFormsDatabaseEnabled } from "@/lib/forms/db";
import { listSesNoticesForIds, type DeliverySesNotice } from "@/lib/ses/store";
import { getWorkflow, listRunDeliveries, listWorkflowRuns } from "@/lib/workflows/store";
import { tickWorkflows } from "@/lib/workflows/scheduler";
import type { WorkflowDeliveryRecord } from "@/lib/workflows/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function withNotices(delivery: WorkflowDeliveryRecord, notices: DeliverySesNotice[]) {
  const ids = new Set(delivery.messageIds);
  const sesNotices =
    delivery.channel === "email"
      ? notices.filter(
          (notice) =>
            notice.recipientEmail.toLowerCase() === delivery.recipientEmail.toLowerCase() &&
            notice.correlationIds.some((id) => ids.has(id)),
        )
      : [];
  return {
    ...delivery,
    sesNotices: sesNotices.map((notice) => ({
      eventType: notice.eventType,
      bounceType: notice.bounceType,
      outcome: notice.outcome,
      occurredAt: notice.occurredAt,
    })),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkflowAuthorAccess();
  if ("response" in access) return access.response;
  if (!isFormsDatabaseEnabled()) {
    return Response.json({ error: "Workflows need Postgres (DATABASE_URL)." }, { status: 503 });
  }
  const { id } = await params;
  try {
    void tickWorkflows();
    const workflow = await getWorkflow(id);
    if (!workflow) return Response.json({ error: "Workflow not found." }, { status: 404 });
    const runs = await listWorkflowRuns(id);
    const deliveries = await listRunDeliveries(runs.map((run) => run.id));
    const notices = await listSesNoticesForIds(deliveries.flatMap((delivery) => delivery.messageIds)).catch(() => []);
    return Response.json({ runs, deliveries: deliveries.map((delivery) => withNotices(delivery, notices)) });
  } catch (error) {
    return formsAuthErrorResponse(error);
  }
}
