import { requireWorkflowAuthorAccess } from "@/lib/forms/forms-api";
import { isFormsDatabaseEnabled } from "@/lib/forms/db";
import { getWorkflow } from "@/lib/workflows/store";
import { insertNotifications } from "@/lib/workflows/notifications";
import { insertWorkflowRun, updateWorkflowRun } from "@/lib/workflows/store";
import { normalizeEmail } from "@/lib/workflows/recipients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkflowAuthorAccess();
  if ("response" in access) return access.response;
  if (!isFormsDatabaseEnabled()) {
    return Response.json({ error: "Workflows need Postgres (DATABASE_URL)." }, { status: 503 });
  }

  const { id } = await params;
  const workflow = await getWorkflow(id);
  if (!workflow) return Response.json({ error: "Workflow not found." }, { status: 404 });
  if (workflow.templateKind !== "alert") {
    return Response.json({ error: "Preview is only available for Alert workflows." }, { status: 400 });
  }

  const email = normalizeEmail(access.user.email);
  if (!email) {
    return Response.json(
      { error: "Your account username is not an email, so a preview cannot be delivered to this inbox." },
      { status: 400 },
    );
  }

  const run = await insertWorkflowRun({
    workflowId: workflow.id,
    sheetId: workflow.sheetId,
    rowId: null,
    eventKey: `preview:${Date.now()}`,
    status: "pending",
  });
  if (!run) return Response.json({ error: "Could not record preview." }, { status: 500 });

  await insertNotifications({
    emails: [email],
    title: workflow.action.title || workflow.name,
    body: workflow.action.body || "This is a preview of your alert.",
    payload: {
      sheetId: workflow.sheetId,
      rowId: null,
      href: `/forms/sheet?sheetId=${encodeURIComponent(workflow.sheetId)}`,
      fields: [],
      templateKind: "alert",
    },
    workflowId: workflow.id,
    runId: run.id,
  });
  await updateWorkflowRun(run.id, "sent");
  return Response.json({ ok: true, email });
}
