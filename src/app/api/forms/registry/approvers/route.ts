import { NextResponse } from "next/server";
import { auditFromPrincipal } from "@/lib/audit";
import { createFormApproverAccount, listFormApprovers } from "@/lib/forms/approver-users";
import { requireFormsAdminAccess } from "@/lib/forms/forms-api";
import { resolveAdminPrincipal } from "@/lib/identity";

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

export async function POST(request: Request) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  try {
    const approver = await createFormApproverAccount(email, password);
    await auditFromPrincipal(await resolveAdminPrincipal(), "forms.approver.create", "approver", String(approver.id), {
      email: approver.email,
    });
    return NextResponse.json({ ok: true, approver });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed.";
    const status = message.includes("already exists") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
