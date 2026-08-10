import { NextResponse } from "next/server";
import { ensureBootstrapped } from "@/lib/forms/init";
import { requireStudentSession } from "@/lib/forms/student-auth";
import { assertOwnedRow, loadOwnedSheetContext, serializeRowCells } from "@/lib/forms/student-rows";

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

    const submission = loaded.context.submissions.find((s) => s.rowId === rowIdNum);

    return NextResponse.json({
      sheetId: loaded.context.entry.sheetId,
      name:
        typeof loaded.context.sheet.name === "string" && loaded.context.sheet.name.trim()
          ? loaded.context.sheet.name
          : loaded.context.entry.name,
      rowId: rowIdNum,
      submission: submission ?? null,
      cells: serializeRowCells(row, loaded.context.columns),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load submission." },
      { status: 500 },
    );
  }
}
