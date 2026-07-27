import { NextResponse } from "next/server";
import { auditFromPrincipal } from "@/lib/audit";
import { deleteFormApproverAccount, resetFormApproverPassword } from "@/lib/forms/approver-users";
import { requireFormsAdminAccess } from "@/lib/forms/forms-api";
import { resolveAdminPrincipal } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";

  if (!password) {
    return NextResponse.json({ error: "Password is required." }, { status: 400 });
  }

  try {
    await resetFormApproverPassword(id, password);
    await auditFromPrincipal(await resolveAdminPrincipal(), "forms.approver.password_reset", "approver", id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed.";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  const { id } = await params;

  try {
    await deleteFormApproverAccount(id);
    await auditFromPrincipal(await resolveAdminPrincipal(), "forms.approver.delete", "approver", id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed.";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
