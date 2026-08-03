import { canReviewContactChanges } from "@/lib/admin-users";
import { formsAuthErrorResponse, requireFormsAdminAccess } from "@/lib/forms/forms-api";
import { ensureBootstrapped } from "@/lib/forms/init";
import { listContactChangeRequests, type ContactChangeStatus } from "@/lib/forms/store/contact-change-requests";
import { getCurrentAdminAuthResult } from "@/lib/admin-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List contact-change / reroute requests for Programs Team review. */
export async function GET(request: Request) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  const auth = await getCurrentAdminAuthResult();
  if (!auth.ok || !auth.principal || !canReviewContactChanges(auth.principal.role)) {
    return Response.json({ error: "Programs Team or admin access is required." }, { status: 403 });
  }

  await ensureBootstrapped();

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status") ?? "pending";
  const status =
    statusParam === "all" || statusParam === "pending" || statusParam === "approved" || statusParam === "rejected"
      ? (statusParam as ContactChangeStatus | "all")
      : "pending";

  try {
    const requests = await listContactChangeRequests({ status });
    return Response.json({ requests });
  } catch (error) {
    return formsAuthErrorResponse(error);
  }
}
