import { NextResponse } from "next/server";
import { ensureBootstrapped } from "@/lib/forms/init";
import { discoverStudentSheets } from "@/lib/forms/student-access";
import { requireStudentSession } from "@/lib/forms/student-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireStudentSession();
  if (!session.ok) return session.response;

  await ensureBootstrapped();

  try {
    const sheets = await discoverStudentSheets(session.email);
    return NextResponse.json({
      email: session.email,
      sheets: sheets.map((s) => ({
        sheetId: s.sheetId,
        name: s.name,
        slug: s.slug,
        ownedRowCount: s.ownedRowCount,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load your sheets." },
      { status: 500 },
    );
  }
}
