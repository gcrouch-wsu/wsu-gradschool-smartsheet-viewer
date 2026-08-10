import { NextResponse } from "next/server";
import { ensureBootstrapped } from "@/lib/forms/init";
import { requireStudentSession } from "@/lib/forms/student-auth";
import { loadOwnedSheetContext } from "@/lib/forms/student-rows";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sheetId: string }> },
) {
  const session = await requireStudentSession();
  if (!session.ok) return session.response;

  await ensureBootstrapped();
  const { sheetId } = await params;

  try {
    const loaded = await loadOwnedSheetContext(sheetId, session.email);
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }

    const { context } = loaded;
    return NextResponse.json({
      sheetId: context.entry.sheetId,
      name:
        typeof context.sheet.name === "string" && context.sheet.name.trim()
          ? context.sheet.name
          : context.entry.name,
      slug: context.entry.slug,
      ownedRowCount: context.ownedRows.length,
      rows: context.submissions.map((s) => ({
        rowId: s.rowId,
        label: s.label,
        email: s.email,
        createdAt: s.createdAt,
        overall: s.overall,
        approvalStatus: s.approvalStatus,
        stages: s.stages,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load rows." },
      { status: 500 },
    );
  }
}
