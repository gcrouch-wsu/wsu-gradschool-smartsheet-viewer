import { auditFromPrincipal } from "@/lib/audit";
import { canReviewContactChanges, getCurrentAdminAuthResult } from "@/lib/admin-users";
import { buildContactChangeCells } from "@/lib/forms/contact-change";
import { formsAuthErrorResponse, requireFormsAdminAccess } from "@/lib/forms/forms-api";
import { ensureBootstrapped } from "@/lib/forms/init";
import {
  findResendColumnForStage,
  resolveResendPulseValues,
  type SheetColumnRef,
} from "@/lib/forms/resend";
import * as ss from "@/lib/forms/smartsheet-api";
import {
  ContactChangeStoreError,
  getContactChangeRequest,
  updateContactChangeRequest,
} from "@/lib/forms/store/contact-change-requests";
import { resolveAdminPrincipal } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireProgramsReviewer() {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access;
  const auth = await getCurrentAdminAuthResult();
  if (!auth.ok || !auth.principal || !canReviewContactChanges(auth.principal.role)) {
    return { response: Response.json({ error: "Programs Team or admin access is required." }, { status: 403 }) };
  }
  return { principal: auth.principal, access };
}

/**
 * Approve a pending contact reroute: write Smartsheet cells, then RESEND if current stage.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireProgramsReviewer();
  if ("response" in gate) return gate.response;

  const { id } = await params;
  await ensureBootstrapped();

  const body = await request.json().catch(() => ({}));
  const reviewNote = typeof body.reviewNote === "string" ? body.reviewNote.trim() : "";

  try {
    const current = await getContactChangeRequest(id);
    if (!current) {
      return Response.json({ error: "Request not found." }, { status: 404 });
    }
    if (current.status !== "pending") {
      return Response.json({ error: `Request is already ${current.status}.` }, { status: 409 });
    }

    const cells = buildContactChangeCells({
      fields: current.fields,
      proposedName: current.proposedName,
      proposedEmail: current.proposedEmail,
    });
    if (cells.length === 0) {
      return Response.json({ error: "No cells to update." }, { status: 422 });
    }

    await ss.updateRows(current.sheetId, [{ id: current.rowId, cells }]);

    let resend: { columnTitle: string; pulsed: boolean } | null = null;
    if (current.isCurrentStage) {
      const sheet = await ss.getSheet(current.sheetId);
      const columns = (sheet.columns ?? []) as Array<{
        id: number;
        title?: string;
        type?: string;
        options?: string[];
      }>;
      const colRefs: SheetColumnRef[] = columns.map((c) => ({
        id: c.id,
        title: String(c.title ?? ""),
        type: c.type,
        options: Array.isArray(c.options) ? c.options.map(String) : undefined,
      }));
      const resendCol = findResendColumnForStage(colRefs, current.stageTitle);
      if (resendCol) {
        const pulse = resolveResendPulseValues(resendCol);
        if (pulse) {
          const rows = (Array.isArray(sheet.rows) ? sheet.rows : []) as Array<{
            id: number;
            cells?: Array<{ columnId: number; value?: unknown; displayValue?: unknown }>;
          }>;
          const row = rows.find((r) => r.id === current.rowId);
          const cell = row?.cells?.find((c) => c.columnId === resendCol.id);
          const armed = pulse.isArmed(cell?.value, cell?.displayValue);
          if (armed) {
            await ss.updateRows(current.sheetId, [
              { id: current.rowId, cells: [{ columnId: resendCol.id, value: pulse.clear as string | boolean }] },
            ]);
          }
          await ss.updateRows(current.sheetId, [
            { id: current.rowId, cells: [{ columnId: resendCol.id, value: pulse.set as string | boolean }] },
          ]);
          resend = { columnTitle: resendCol.title, pulsed: true };
        }
      }
    }

    const reviewed = await updateContactChangeRequest(id, {
      status: "approved",
      reviewedBy: {
        id: gate.principal.id,
        name: gate.principal.displayName ?? gate.principal.username,
        email: gate.principal.username.includes("@") ? gate.principal.username : undefined,
      },
      reviewedAt: new Date().toISOString(),
      reviewNote: reviewNote || undefined,
    });

    const actor = await resolveAdminPrincipal();
    await auditFromPrincipal(actor, "forms.contact_change.approved", "form_row", `${current.sheetId}:${current.rowId}`, {
      requestId: id,
      stageTitle: current.stageTitle,
      proposedEmail: current.proposedEmail,
      resend,
    });

    return Response.json({
      request: reviewed,
      resend,
      message: current.isCurrentStage
        ? resend?.pulsed
          ? "Contact updated and approval notification resent to the new approver."
          : "Contact updated. No matching RESEND column was found — notify the new approver from Smartsheet if needed."
        : "Contact updated for a future approval stage. No notification was sent yet.",
    });
  } catch (error) {
    if (error instanceof ContactChangeStoreError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return formsAuthErrorResponse(error);
  }
}
