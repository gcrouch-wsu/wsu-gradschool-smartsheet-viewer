import { config } from "@/lib/forms/config";
import * as ss from "@/lib/forms/smartsheet-api";
import * as registry from "@/lib/forms/registry";
import { findCurrentStage } from "@/lib/forms/submission-actions";
import {
  findPendingContactEmail,
  findResendColumnForStage,
  isCheckboxChecked,
  isResendColumnTitle,
} from "@/lib/forms/resend";
import { rateLimit } from "@/lib/forms/rate-limit";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsApproverAccess } from "@/lib/forms/forms-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Re-trigger the sheet's Path A notification for the pending approval stage by
 * pulsing the matching RESEND* checkbox (Smartsheet automations watch that change).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ rowId: string }> },
) {
  const access = await requireFormsApproverAccess(request);
  if ("response" in access) return access.response;

  const { rowId } = await params;
  await ensureBootstrapped();

  if (!(await rateLimit("resend:submission"))) {
    return Response.json({ error: "Too many resend requests. Please wait a minute." }, { status: 429 });
  }

  const active = await registry.activeSheetId();
  if (!active) return Response.json({ error: "No form selected yet." }, { status: 409 });

  const body = await request.json().catch(() => ({}));
  const requestedColumnTitle = body.columnTitle ? String(body.columnTitle).trim() : "";

  try {
    const sheet = await ss.getSheet(active);
    const rowIdNum = Number(rowId);
    const columns = (sheet.columns ?? []) as Array<{ id: number; title?: string; type?: string }>;
    const colRefs = columns.map((c) => ({
      id: c.id,
      title: String(c.title ?? ""),
      type: c.type,
    }));

    const current = await findCurrentStage(sheet, rowIdNum);
    if (!current) {
      return Response.json(
        { error: "No pending approval stage for this submission — nothing to resend." },
        { status: 409 },
      );
    }

    let resendCol = findResendColumnForStage(colRefs, current.name);
    if (requestedColumnTitle) {
      if (!isResendColumnTitle(requestedColumnTitle)) {
        return Response.json({ error: "columnTitle must be a RESEND* column." }, { status: 422 });
      }
      const explicit = colRefs.find((c) => c.title.toLowerCase() === requestedColumnTitle.toLowerCase());
      if (!explicit) return Response.json({ error: "Resend column not found on this sheet." }, { status: 422 });
      const matched = findResendColumnForStage([explicit], current.name);
      if (!matched) {
        return Response.json(
          {
            error: `Resend column "${explicit.title}" does not match the pending stage "${current.name}".`,
          },
          { status: 409 },
        );
      }
      resendCol = explicit;
    }

    if (!resendCol) {
      return Response.json(
        {
          error: `No RESEND column matched the pending stage "${current.name}". Add a checkbox like "RESEND ${current.name}" and wire it to Automation → Request an approval.`,
        },
        { status: 409 },
      );
    }

    const row =
      ((sheet.rows ?? []) as Array<{ id: number; cells?: Array<{ columnId: number; value?: unknown; displayValue?: unknown }> }>).find(
        (r) => r.id === rowIdNum,
      ) ?? ((await ss.getRow(active, rowIdNum)) as { cells?: Array<{ columnId: number; value?: unknown; displayValue?: unknown }> });

    const cell = (row.cells ?? []).find((c) => c.columnId === resendCol.id);
    const alreadyChecked = isCheckboxChecked(cell?.value, cell?.displayValue);

    // Automations typically fire when the checkbox becomes checked. If it is already
    // checked, clear it first so the second write re-fires the workflow.
    if (alreadyChecked) {
      await ss.updateRows(active, [{ id: rowIdNum, cells: [{ columnId: resendCol.id, value: false }] }]);
    }
    await ss.updateRows(active, [{ id: rowIdNum, cells: [{ columnId: resendCol.id, value: true }] }]);

    const recipientEmail = findPendingContactEmail(colRefs, row.cells, current.name);

    return Response.json({
      ok: true,
      demo: config.demo,
      stage: current.name,
      resendColumn: resendCol.title,
      recipientEmail: recipientEmail || null,
      message: recipientEmail
        ? `Resend triggered for ${current.name}. Smartsheet should notify ${recipientEmail}.`
        : `Resend triggered for ${current.name}. Smartsheet will email contacts configured on that automation.`,
    });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
