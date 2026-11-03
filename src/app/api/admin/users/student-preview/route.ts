import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/admin-api";
import {
  applyStudentPreviewCookie,
  createStudentPreviewToken,
} from "@/lib/forms/student-preview";
import { getPlatformUserByEmail } from "@/lib/platform-users";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAdminApiAccess({ usersOnly: true });
  if ("response" in auth && auth.response) return auth.response;
  const principal = auth.principal;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  const email =
    typeof (body as { email?: unknown })?.email === "string"
      ? (body as { email: string }).email.trim().toLowerCase()
      : "";

  if (!email) {
    return NextResponse.json({ message: "Email is required." }, { status: 400 });
  }

  const user = await getPlatformUserByEmail(email);
  if (!user || !user.isActive || !user.roles.includes("student")) {
    return NextResponse.json({ message: "No student account uses that email." }, { status: 404 });
  }

  const token = await createStudentPreviewToken(principal.id, user.email);
  const response = NextResponse.json({
    ok: true,
    email: user.email,
    redirectTo: "/student",
  });
  applyStudentPreviewCookie(response, token);
  return response;
}
