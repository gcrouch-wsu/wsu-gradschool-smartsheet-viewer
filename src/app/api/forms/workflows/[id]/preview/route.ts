import { listSourceConfigs } from "@/lib/config/store";
import { requireWorkflowAuthorAccess } from "@/lib/forms/forms-api";
import { isFormsDatabaseEnabled } from "@/lib/forms/db";
import { getWorkflow } from "@/lib/workflows/store";
import { deliverWorkflowNotifications } from "@/lib/workflows/deliver";
import { resolveRecipients } from "@/lib/workflows/execute-action";
import { insertWorkflowRun, updateWorkflowRun } from "@/lib/workflows/store";
import { normalizeEmail } from "@/lib/workflows/recipients";
import { fieldsFromCells, loadAlertRow, renderAlertCopy } from "@/lib/workflows/alert-content";
import { notificationHref } from "@/lib/workflows/visible-notifications";

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

  const loaded = await loadAlertRow(workflow.sheetId, null).catch(() => null);
  const configured = resolveRecipients(workflow, loaded?.cells ?? []);
  const fallback = normalizeEmail(access.user.email);
  const emails = configured.length ? configured : fallback ? [fallback] : [];
  if (!emails.length) {
    return Response.json(
      { error: "Add a recipient on the workflow, or sign in with an email address, before sending a preview." },
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

  const fields = loaded ? fieldsFromCells(loaded.columns, loaded.cells) : [];
  const rendered = renderAlertCopy({
    titleTemplate: workflow.action.title || workflow.name,
    bodyTemplate: workflow.action.body || "This is a preview of your alert.",
    fallbackTitle: workflow.name,
    fields,
    primaryTitle: loaded?.columns.primaryTitle ?? null,
    includeColumnIds: workflow.action.includeColumnIds,
    idByTitle: loaded?.columns.idByTitle ?? new Map(),
  });
  const rowId = loaded?.rowId ?? null;
  const sources = await listSourceConfigs();
  const source = sources.find(
    (entry) => entry.sourceType === "sheet" && String(entry.smartsheetId) === String(workflow.sheetId),
  );

  const delivered = await deliverWorkflowNotifications({
    emails,
    title: rendered.title,
    body: rendered.body,
    payload: {
      sheetId: workflow.sheetId,
      rowId,
      href: source ? notificationHref(source, rowId, "staff") : undefined,
      fields: rendered.fields,
      templateKind: "alert",
    },
    workflowId: workflow.id,
    runId: run.id,
    channels: workflow.action.channels ?? ["in_app"],
  });
  if (delivered.channels.includes("email") && delivered.emailQueued > 0) {
    await updateWorkflowRun(run.id, "pending");
  } else if (delivered.emailFailed > 0) {
    await updateWorkflowRun(run.id, "failed", delivered.emailError);
  } else {
    await updateWorkflowRun(run.id, "sent");
  }
  const waitingForSes = delivered.channels.includes("email") && delivered.emailQueued > 0;
  return Response.json({
    ok: true,
    email: emails.join(", "),
    message: waitingForSes
      ? `Preview handed to Amazon SES for ${emails.join(", ")}. The run shows sent after SES reports delivery.`
      : `Preview sent to ${emails.join(", ")}.`,
  });
}
