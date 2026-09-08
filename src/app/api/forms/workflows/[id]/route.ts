import { formsAuthErrorResponse, requireWorkflowAuthorAccess } from "@/lib/forms/forms-api";
import { isFormsDatabaseEnabled } from "@/lib/forms/db";
import { deleteWorkflow, getWorkflow, updateWorkflow } from "@/lib/workflows/store";
import { workflowBody } from "@/app/api/forms/workflows/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorEmail(username: string): string | null {
  return username.includes("@") ? username.trim().toLowerCase() : null;
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
  const workflow = await getWorkflow(id);
  if (!workflow) return Response.json({ error: "Workflow not found." }, { status: 404 });
  return Response.json({ workflow });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkflowAuthorAccess();
  if ("response" in access) return access.response;
  if (!isFormsDatabaseEnabled()) {
    return Response.json({ error: "Workflows need Postgres (DATABASE_URL)." }, { status: 503 });
  }

  const { id } = await params;
  const existing = await getWorkflow(id);
  if (!existing) return Response.json({ error: "Workflow not found." }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const workflow = await updateWorkflow(
      id,
      {
        ...workflowBody(body, existing.sheetId, existing.createdByEmail ?? authorEmail(access.user.email)),
        createdByEmail: existing.createdByEmail,
      },
    );
    return Response.json({ workflow });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update workflow.";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
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
    const removed = await deleteWorkflow(id);
    if (!removed) return Response.json({ error: "Workflow not found." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    return formsAuthErrorResponse(error);
  }
}
