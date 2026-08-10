import { auditFromPrincipal } from "@/lib/audit";
import { resolveAllowedDomains } from "@/lib/forms/allowed-domains";
import {
  buildContactChangeCells,
  findStageContactFields,
  isValidContactEmail,
  isValidContactName,
} from "@/lib/forms/contact-change";
import { formsAuthErrorResponse, requireFormsApproverAccess } from "@/lib/forms/forms-api";
import { ensureBootstrapped } from "@/lib/forms/init";
import { rateLimit } from "@/lib/forms/rate-limit";
import { findEditableContactStages } from "@/lib/forms/submission-actions";
import * as ss from "@/lib/forms/smartsheet-api";
import { loadFormFields } from "@/lib/forms/store/field-config";
import {
  ContactChangeStoreError,
  createContactChangeRequest,
  listContactChangeRequests,
} from "@/lib/forms/store/contact-change-requests";
import type { SheetColumnRef } from "@/lib/forms/resend";
import { resolveFormsSheetId, sheetIdFromRequestOrBody } from "@/lib/forms/sheet-access";
import { resolveAdminPrincipal, resolveApproverPrincipal } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET — list editable stages + contact fields for a submission (staff).
 * POST — propose a contact reroute (queued for Programs Team; Smartsheet not updated yet).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ rowId: string }> },
) {
  const access = await requireFormsApproverAccess(request);
  if ("response" in access) return access.response;

  const { rowId } = await params;
  await ensureBootstrapped();

  const resolved = await resolveFormsSheetId(sheetIdFromRequestOrBody(request, null));
  if (!resolved.ok) {
    return Response.json({ error: resolved.error }, { status: resolved.status });
  }

  try {
    const sheet = await ss.getSheet(resolved.sheetId);
    const rowIdNum = Number(rowId);
    const stages = await findEditableContactStages(sheet, rowIdNum);
    const columns = (sheet.columns ?? []) as Array<{ id: number; title?: string; type?: string }>;
    const colRefs: SheetColumnRef[] = columns.map((c) => ({
      id: c.id,
      title: String(c.title ?? ""),
      type: c.type,
    }));
    const rows = (Array.isArray(sheet.rows) ? sheet.rows : []) as Array<{
      id: number;
      cells?: Array<{ columnId: number; value?: unknown; displayValue?: unknown }>;
    }>;
    const row = rows.find((r) => r.id === rowIdNum);

    const history = await listContactChangeRequests({
      status: "all",
      sheetId: resolved.sheetId,
      rowId: rowIdNum,
    });
    const pending = history.filter((r) => r.status === "pending");
    const fieldConfig = await loadFormFields(resolved.sheetId);
    const allowedDomains = resolveAllowedDomains(fieldConfig);

    return Response.json({
      sheetId: resolved.sheetId,
      sheetName: typeof sheet.name === "string" ? sheet.name : undefined,
      allowedDomains,
      history,
      stages: stages.map((st) => {
        const bundle = findStageContactFields(colRefs, row?.cells, st.name);
        const pendingForStage = pending.find(
          (p) => p.stageTitle.toLowerCase() === st.name.toLowerCase(),
        );
        return {
          name: st.name,
          columnId: st.columnId,
          isCurrent: st.isCurrent,
          contact: bundle,
          pendingRequestId: pendingForStage?.id ?? null,
          pendingProposedEmail: pendingForStage?.proposedEmail ?? null,
          pendingProposedName: pendingForStage?.proposedName ?? null,
        };
      }),
    });
  } catch (error) {
    return formsAuthErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ rowId: string }> },
) {
  const access = await requireFormsApproverAccess(request);
  if ("response" in access) return access.response;

  const { rowId } = await params;
  await ensureBootstrapped();

  if (!(await rateLimit("contact-change:propose"))) {
    return Response.json({ error: "Too many requests. Please wait a minute." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const resolved = await resolveFormsSheetId(sheetIdFromRequestOrBody(request, body));
  if (!resolved.ok) {
    return Response.json({ error: resolved.error }, { status: resolved.status });
  }

  const stageTitle = typeof body.stageTitle === "string" ? body.stageTitle.trim() : "";
  const proposedName = typeof body.proposedName === "string" ? body.proposedName.trim() : "";
  const proposedEmail = typeof body.proposedEmail === "string" ? body.proposedEmail.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (!stageTitle) {
    return Response.json({ error: "stageTitle is required." }, { status: 422 });
  }

  const nameError = isValidContactName(proposedName);
  if (nameError) {
    return Response.json({ error: nameError }, { status: 422 });
  }

  const fieldConfig = await loadFormFields(resolved.sheetId);
  const allowedDomains = resolveAllowedDomains(fieldConfig);
  const emailError = isValidContactEmail(proposedEmail, allowedDomains);
  if (emailError) {
    return Response.json({ error: emailError }, { status: 422 });
  }

  try {
    const sheet = await ss.getSheet(resolved.sheetId);
    const rowIdNum = Number(rowId);
    const editable = await findEditableContactStages(sheet, rowIdNum);
    const stage = editable.find((s) => s.name.toLowerCase() === stageTitle.toLowerCase());
    if (!stage) {
      return Response.json(
        {
          error: `Stage "${stageTitle}" is not editable — it may already be approved or the submission was declined.`,
        },
        { status: 409 },
      );
    }

    const columns = (sheet.columns ?? []) as Array<{ id: number; title?: string; type?: string }>;
    const colRefs: SheetColumnRef[] = columns.map((c) => ({
      id: c.id,
      title: String(c.title ?? ""),
      type: c.type,
    }));
    const rows = (Array.isArray(sheet.rows) ? sheet.rows : []) as Array<{
      id: number;
      cells?: Array<{ columnId: number; value?: unknown; displayValue?: unknown }>;
    }>;
    const row = rows.find((r) => r.id === rowIdNum);
    if (!row) {
      return Response.json({ error: "Submission row not found." }, { status: 404 });
    }

    const bundle = findStageContactFields(colRefs, row.cells, stage.name);
    if (bundle.fields.length === 0) {
      return Response.json(
        {
          error: `No contact/name/email columns matched stage "${stage.name}". Check that the sheet has matching Name/Email or CONTACT columns.`,
        },
        { status: 409 },
      );
    }

    // Ensure we can build writes (validation only — do not write yet).
    const previewCells = buildContactChangeCells({
      fields: bundle.fields,
      proposedName,
      proposedEmail,
    });
    if (previewCells.length === 0) {
      return Response.json({ error: "Could not build contact cell updates." }, { status: 422 });
    }

    const admin = await resolveAdminPrincipal();
    const approver = admin ? null : await resolveApproverPrincipal(request);
    const actor = admin ?? approver;

    const requestRecord = await createContactChangeRequest({
      sheetId: resolved.sheetId,
      sheetName: typeof sheet.name === "string" ? sheet.name : undefined,
      rowId: rowIdNum,
      rowLabel: undefined,
      stageTitle: stage.name,
      isCurrentStage: stage.isCurrent,
      fields: bundle.fields.map((f) => ({
        columnId: f.columnId,
        columnTitle: f.columnTitle,
        columnType: f.columnType,
        kind: f.kind,
        previousDisplay: f.currentDisplay,
        previousEmail: f.currentEmail,
        previousName: f.currentName,
      })),
      proposedName,
      proposedEmail,
      note: note || undefined,
      requestedByKind: "staff",
      requestedBy: {
        id: actor?.id ?? access.user.email,
        name: actor?.displayName ?? access.user.name,
        email: actor?.email ?? access.user.email,
      },
    });

    await auditFromPrincipal(
      actor,
      "forms.contact_change.proposed",
      "form_row",
      `${resolved.sheetId}:${rowIdNum}`,
      {
        requestId: requestRecord.id,
        stageTitle: stage.name,
        proposedEmail,
        proposedName,
      },
    );

    return Response.json(
      {
        request: requestRecord,
        message:
          "Reroute submitted for Programs Team review. The new approver will not be notified until the change is approved.",
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ContactChangeStoreError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return formsAuthErrorResponse(error);
  }
}
