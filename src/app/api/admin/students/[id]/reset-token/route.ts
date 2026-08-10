import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/admin-api";
import { createStudentResetToken, listStudentUsers } from "@/lib/forms/student-users";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApiAccess();
  if (auth.response) return auth.response;
  const { id } = await params;
  const users = await listStudentUsers();
  const user = users.find((u) => u.id === id);
  if (!user) return NextResponse.json({ message: "Student not found" }, { status: 404 });
  const token = await createStudentResetToken(user.email);
  return NextResponse.json({ token });
}
