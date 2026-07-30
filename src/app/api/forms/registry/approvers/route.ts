import { NextResponse } from "next/server";
import { listFormApprovers } from "@/lib/forms/approver-users";
import { requireFormsAdminAccess } from "@/lib/forms/forms-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  try {
    const approvers = await listFormApprovers();
    return Response.json({ approvers });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Form approver accounts are no longer created here. Add a Coordinator (or Admin) from Users at /admin/users.",
    },
    { status: 410 },
  );
}
