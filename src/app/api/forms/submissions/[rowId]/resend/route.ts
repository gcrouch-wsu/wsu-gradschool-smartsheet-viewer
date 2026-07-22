import { config } from "@/lib/forms/config";
import * as ss from "@/lib/forms/smartsheet-api";
import * as registry from "@/lib/forms/registry";
import { findCurrentStage } from "@/lib/forms/submission-actions";
import {
  findPendingContactEmail,
  findResendColumnForStage,
  isResendColumnTitle,
  isStandaloneResendColumn,
  resolveResendPulseValues,
  type SheetColumnRef,
} from "@/lib/forms/resend";
import { rateLimit } from "@/lib/forms/rate-limit";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsApproverAccess } from "@/lib/forms/forms-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Re-trigger a Smartsheet automation by pulsing a RESEND* helper column.
 * - Stage-linked helpers (RESEND Chair Approval, …): require a matching pending stage.
 * - Standalone helpers (RESEND Final PDF): can be pulsed anytime by columnTitle.
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

    const current = await findCurrentStage(sheet, rowIdNum);
    let resendCol: SheetColumnRef | null = null;
    let stageLabel = current?.name ?? "";

    if (requestedColumnTitle) {
      if (!isResendColumnTitle(requestedColumnTitle)) {
        return Response.json({ error: "columnTitle must be a RESEND* column." }, { status: 422 });
      }
      const explicit = colRefs.find((c) => c.title.toLowerCase() === requestedColumnTitle.toLowerCase());
      if (!explicit) return Response.json({ error: "Resend column not found on this sheet." }, { status: 422 });

      if (isStandaloneResendColumn(explicit.title)) {
        resendCol = explicit;
        stageLabel = resendTargetFromTitle(explicit.title);
      } else {
        if (!current) {
          return Response.json(
            { error: "No pending approval stage for this submission — nothing to resend." },
            { status: 409 },
          );
        }
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
        stageLabel = current.name;
      }
    } else {
      if (!current) {
        return Response.json(
          { error: "No pending approval stage for this submission — nothing to resend." },
          { status: 409 },
        );
      }
      resendCol = findResendColumnForStage(colRefs, current.name);
      stageLabel = current.name;
      if (!resendCol) {
        return Response.json(
          {
            error: `No RESEND column matched the pending stage "${current.name}". Add a helper column like "RESEND ${current.name}" and wire it to Automation → Request an approval.`,
          },
          { status: 409 },
        );
      }
    }

    const pulse = resolveResendPulseValues(resendCol);
    if (!pulse) {
      const opts = resendCol.options?.length ? resendCol.options.join(", ") : "(none)";
      return Response.json(
        {
          error: `Cannot pulse "${resendCol.title}" (${resendCol.type ?? "unknown"}). Picklist options: ${opts}.`,
        },
        { status: 422 },
      );
    }

    const row =
      ((sheet.rows ?? []) as Array<{
        id: number;
        cells?: Array<{ columnId: number; value?: unknown; displayValue?: unknown }>;
      }>).find((r) => r.id === rowIdNum) ??
      ((await ss.getRow(active, rowIdNum)) as {
        cells?: Array<{ columnId: number; value?: unknown; displayValue?: unknown }>;
      });

    const cell = (row.cells ?? []).find((c) => c.columnId === resendCol.id);
    const alreadyArmed = pulse.isArmed(cell?.value, cell?.displayValue);

    if (alreadyArmed) {
      await ss.updateRows(active, [{ id: rowIdNum, cells: [{ columnId: resendCol.id, value: pulse.clear }] }]);
    }
    await ss.updateRows(active, [{ id: rowIdNum, cells: [{ columnId: resendCol.id, value: pulse.set }] }]);

    const recipientEmail = current
      ? findPendingContactEmail(colRefs, row.cells, current.name)
      : findPendingContactEmail(colRefs, row.cells, stageLabel);

    return Response.json({
      ok: true,
      demo: config.demo,
      stage: stageLabel || null,
      resendColumn: resendCol.title,
      resendColumnType: resendCol.type ?? null,
      pulsedValue: pulse.set,
      recipientEmail: recipientEmail || null,
      message: recipientEmail
        ? `Resend triggered for ${stageLabel || resendCol.title}. Smartsheet should notify ${recipientEmail}.`
        : `Resend triggered for ${stageLabel || resendCol.title}. Smartsheet will run the automation for that helper column.`,
    });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}

function resendTargetFromTitle(title: string): string {
  return title.trim().replace(/^resend\s+/i, "").trim();
}
