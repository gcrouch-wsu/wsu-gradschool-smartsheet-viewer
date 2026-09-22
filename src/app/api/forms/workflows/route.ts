import { formsAuthErrorResponse, requireWorkflowAuthorAccess } from "@/lib/forms/forms-api";
import * as registry from "@/lib/forms/registry";
import { ensureBootstrapped } from "@/lib/forms/init";
import { isFormsDatabaseEnabled } from "@/lib/forms/db";
import { WORKFLOW_TEMPLATES, workflowCategories } from "@/lib/workflows/catalog";
import { createWorkflow, listWorkflows } from "@/lib/workflows/store";
import { listKnownEmails } from "@/lib/workflows/notifications";
import { workflowBody } from "@/lib/workflows/workflow-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorEmail(username: string): string | null {
  return username.includes("@") ? username.trim().toLowerCase() : null;
}

export async function GET(request: Request) {
  const access = await requireWorkflowAuthorAccess();
  if ("response" in access) return access.response;
  if (!isFormsDatabaseEnabled()) {
    return Response.json({
      workflows: [],
      catalog: workflowCategories(),
      templates: WORKFLOW_TEMPLATES,
      available: false,
      notice: "Workflows need Postgres (DATABASE_URL). They cannot be saved in file-store mode.",
    });
  }

  await ensureBootstrapped();
  const url = new URL(request.url);
  const sheetId = url.searchParams.get("sheetId")?.trim() || (await registry.activeSheetId());
  try {
    const workflows = sheetId ? await listWorkflows(sheetId) : [];
    const people = url.searchParams.get("people") === "1" ? await listKnownEmails() : [];
    return Response.json({
      workflows,
      catalog: workflowCategories(),
      templates: WORKFLOW_TEMPLATES,
      sheetId,
      people,
      available: true,
    });
  } catch (error) {
    return formsAuthErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const access = await requireWorkflowAuthorAccess();
  if ("response" in access) return access.response;
  if (!isFormsDatabaseEnabled()) {
    return Response.json({ error: "Workflows need Postgres (DATABASE_URL)." }, { status: 503 });
  }

  await ensureBootstrapped();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const active = await registry.activeSheetId();
  try {
    const workflow = await createWorkflow(
      workflowBody(body, active, authorEmail(access.user.email)),
    );
    return Response.json({ workflow });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save workflow.";
    return Response.json({ error: message }, { status: 400 });
  }
}
