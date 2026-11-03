import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/admin-api";
import { clearStudentPreviewCookie } from "@/lib/forms/student-preview";

export const runtime = "nodejs";

export async function POST() {
  const auth = await requireAdminApiAccess({ usersOnly: true });
  if (auth.response) return auth.response;

  const response = NextResponse.json({
    ok: true,
    redirectTo: "/admin/users?tab=student-portal",
  });
  clearStudentPreviewCookie(response);
  return response;
}
