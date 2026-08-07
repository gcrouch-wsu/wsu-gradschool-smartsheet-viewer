import { NextResponse } from "next/server";
import { resolveAllowedDomains } from "@/lib/forms/allowed-domains";
import {
  buildContactChangeCells,
  findStageContactFields,
  isValidContactEmail,
  isValidContactName,
} from "@/lib/forms/contact-change";
import { ensureBootstrapped } from "@/lib/forms/init";
import { rateLimit } from "@/lib/forms/rate-limit";
import type { SheetColumnRef } from "@/lib/forms/resend";
import { findEditableContactStages } from "@/lib/forms/submission-actions";
import {
  ContactChangeStoreError,
  createContactChangeRequest,
  listContactChangeRequests,
} from "@/lib/forms/store/contact-change-requests";
import { loadFormFields } from "@/lib/forms/store/field-config";
import { requireStudentSession } from "@/lib/forms/student-auth";
import { assertOwnedRow, loadOwnedSheetContext } from "@/lib/forms/student-rows";
import { getContributorUserByEmail } from "@/lib/contributor-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sheetId: string; rowId: string }> },
) {
  const session = await requireStudentSession();
  if (!session.ok) return session.response;

  await ensureBootstrapped();
  const { sheetId, rowId } = await params;
  const rowIdNum = Number(rowId);
  if (!Number.isFinite(rowIdNum)) {
    return NextResponse.json({ error: "Invalid row id." }, { status: 400 });
  }

  try {
    const loaded = await loadOwnedSheetContext(sheetId, session.email);
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }

    const row = assertOwnedRow(loaded.context, rowIdNum, session.email);
    if (!row) {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }

    const stages = await findEditableContactStages(loaded.context.sheet, rowIdNum);
    const colRefs: SheetColumnRef[] = loaded.context.columns.map((c) => ({
      id: c.id,
      title: String(c.title ?? ""),
      type: c.type,
    }));

    const history = await listContactChangeRequests({
      status: "all",
      sheetId: loaded.context.entry.sheetId,
      rowId: rowIdNum,
    });
    const pending = history.filter((r) => r.status === "pending");
    const fieldConfig = await loadFormFields(loaded.context.entry.sheetId);
    const allowedDomains = resolveAllowedDomains(fieldConfig);

    return NextResponse.json({
      sheetId: loaded.context.entry.sheetId,
      sheetName:
        typeof loaded.context.sheet.name === "string" ? loaded.context.sheet.name : undefined,
      allowedDomains,
      history,
      stages: stages.map((st) => {
        const bundle = findStageContactFields(colRefs, row.cells, st.name);
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load reroute options." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sheetId: string; rowId: string }> },
) {
  const session = await requireStudentSession();
  if (!session.ok) return session.response;

  await ensureBootstrapped();

  if (!(await rateLimit("student-contact-change:propose"))) {
    return NextResponse.json({ error: "Too many requests. Please wait a minute." }, { status: 429 });
  }

  const { sheetId, rowId } = await params;
  const rowIdNum = Number(rowId);
  if (!Number.isFinite(rowIdNum)) {
    return NextResponse.json({ error: "Invalid row id." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const stageTitle = typeof body.stageTitle === "string" ? body.stageTitle.trim() : "";
  const proposedName = typeof body.proposedName === "string" ? body.proposedName.trim() : "";
  const proposedEmail = typeof body.proposedEmail === "string" ? body.proposedEmail.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (!stageTitle) {
    return NextResponse.json({ error: "stageTitle is required." }, { status: 422 });
  }

  const nameError = isValidContactName(proposedName);
  if (nameError) {
    return NextResponse.json({ error: nameError }, { status: 422 });
  }

  try {
    const loaded = await loadOwnedSheetContext(sheetId, session.email);
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }

    const row = assertOwnedRow(loaded.context, rowIdNum, session.email);
    if (!row) {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }

    const fieldConfig = await loadFormFields(loaded.context.entry.sheetId);
    const allowedDomains = resolveAllowedDomains(fieldConfig);
    const emailError = isValidContactEmail(proposedEmail, allowedDomains);
    if (emailError) {
      return NextResponse.json({ error: emailError }, { status: 422 });
    }

    const editable = await findEditableContactStages(loaded.context.sheet, rowIdNum);
    const stage = editable.find((s) => s.name.toLowerCase() === stageTitle.toLowerCase());
    if (!stage) {
      return NextResponse.json(
        {
          error: `Stage "${stageTitle}" is not editable — it may already be approved or the submission was declined.`,
        },
        { status: 409 },
      );
    }

    const colRefs: SheetColumnRef[] = loaded.context.columns.map((c) => ({
      id: c.id,
      title: String(c.title ?? ""),
      type: c.type,
    }));
    const bundle = findStageContactFields(colRefs, row.cells, stage.name);
    if (bundle.fields.length === 0) {
      return NextResponse.json(
        {
          error: `No contact/name/email columns matched stage "${stage.name}".`,
        },
        { status: 409 },
      );
    }

    const previewCells = buildContactChangeCells({
      fields: bundle.fields,
      proposedName,
      proposedEmail,
    });
    if (previewCells.length === 0) {
      return NextResponse.json({ error: "Could not build contact cell updates." }, { status: 422 });
    }

    const user = await getContributorUserByEmail(session.email);

    const requestRecord = await createContactChangeRequest({
      sheetId: loaded.context.entry.sheetId,
      sheetName:
        typeof loaded.context.sheet.name === "string" ? loaded.context.sheet.name : undefined,
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
      requestedByKind: "student",
      requestedBy: {
        id: user?.id ?? session.email,
        name: session.email,
        email: session.email,
      },
    });

    return NextResponse.json(
      {
        request: requestRecord,
        message:
          "Reroute submitted for Programs Team review. The contact will not change until the request is approved.",
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ContactChangeStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to submit reroute." },
      { status: 500 },
    );
  }
}
