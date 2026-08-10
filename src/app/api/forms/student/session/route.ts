import { NextResponse } from "next/server";
import { requireStudentSession } from "@/lib/forms/student-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireStudentSession();
  if (!session.ok) return session.response;
  return NextResponse.json({ email: session.email });
}
