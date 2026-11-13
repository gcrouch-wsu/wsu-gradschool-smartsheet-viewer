import { formsAuthErrorResponse, requireWorkflowAuthorAccess } from "@/lib/forms/forms-api";
import { isFormsDatabaseEnabled } from "@/lib/forms/db";
import { getWorkflow, listRunDeliveries, listWorkflowRuns } from "@/lib/workflows/store";
import { tickWorkflows } from "@/lib/workflows/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    return Response.json({ runs, deliveries });
  } catch (error) {
    return formsAuthErrorResponse(error);
  }
}
