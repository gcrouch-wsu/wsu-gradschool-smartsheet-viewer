import { auditFromPrincipal } from "@/lib/audit";
import { canReviewContactChanges, getCurrentAdminAuthResult } from "@/lib/admin-users";
import { formsAuthErrorResponse, requireFormsAdminAccess } from "@/lib/forms/forms-api";
import { ensureBootstrapped } from "@/lib/forms/init";
import {
  ContactChangeStoreError,
  getContactChangeRequest,
  updateContactChangeRequest,
} from "@/lib/forms/store/contact-change-requests";
import { resolveAdminPrincipal } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reject a pending contact reroute — Smartsheet is left unchanged; no notification. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  const auth = await getCurrentAdminAuthResult();
  if (!auth.ok || !auth.principal || !canReviewContactChanges(auth.principal.role)) {
    return Response.json({ error: "Programs Team or admin access is required." }, { status: 403 });
  }

  const { id } = await params;
  await ensureBootstrapped();

  const body = await request.json().catch(() => ({}));
  const reviewNote = typeof body.reviewNote === "string" ? body.reviewNote.trim() : "";

  try {
    const current = await getContactChangeRequest(id);
    if (!current) {
      return Response.json({ error: "Request not found." }, { status: 404 });
    }

    const reviewed = await updateContactChangeRequest(id, {
      status: "rejected",
      reviewedBy: {
        id: auth.principal.id,
        name: auth.principal.displayName ?? auth.principal.username,
        email: auth.principal.username.includes("@") ? auth.principal.username : undefined,
      },
      reviewedAt: new Date().toISOString(),
      reviewNote: reviewNote || undefined,
    });

    const actor = await resolveAdminPrincipal();
    await auditFromPrincipal(actor, "forms.contact_change.rejected", "form_row", `${current.sheetId}:${current.rowId}`, {
      requestId: id,
      stageTitle: current.stageTitle,
    });

    return Response.json({
      request: reviewed,
      message: "Reroute rejected. Sheet contacts were not changed and no notification was sent.",
    });
  } catch (error) {
    if (error instanceof ContactChangeStoreError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return formsAuthErrorResponse(error);
  }
}
