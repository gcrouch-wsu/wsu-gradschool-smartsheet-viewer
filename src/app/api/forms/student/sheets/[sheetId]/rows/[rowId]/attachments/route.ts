import { NextResponse } from "next/server";
import { ensureBootstrapped } from "@/lib/forms/init";
import * as ss from "@/lib/forms/smartsheet-api";
import { resolveStudentPortalAccess } from "@/lib/forms/student-portal-access";
import { assertOwnedRow, loadOwnedSheetContext } from "@/lib/forms/student-rows";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sheetId: string; rowId: string }> },
) {
  const session = await resolveStudentPortalAccess();
  if (!session.ok) return session.response;

  await ensureBootstrapped();
  const { sheetId, rowId } = await params;
  const rowIdNum = Number(rowId);
  if (!Number.isFinite(rowIdNum)) {
    return NextResponse.json({ error: "Invalid row id." }, { status: 400 });
  }

  try {
    const loaded = await loadOwnedSheetContext(sheetId, session.email);
    if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    if (!assertOwnedRow(loaded.context, rowIdNum, session.email)) {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }

    const attachments = await ss.listAttachments(loaded.context.entry.sheetId, rowIdNum);
    return NextResponse.json({ sheetId: loaded.context.entry.sheetId, attachments });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load attachments." },
      { status: 500 },
    );
  }
}
