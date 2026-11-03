import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/admin-api";
import { auditFromAdminPrincipal } from "@/lib/audit";
import { clearStudentPreviewCookie } from "@/lib/forms/student-preview";

export const runtime = "nodejs";

export async function POST() {
  const auth = await requireAdminApiAccess({ usersOnly: true });
  if (auth.response) return auth.response;

  await auditFromAdminPrincipal(auth.principal, "student.preview.end", "student");
  const response = NextResponse.json({
    ok: true,
    redirectTo: "/admin/users?tab=student-portal",
  });
  clearStudentPreviewCookie(response);
  return response;
}
