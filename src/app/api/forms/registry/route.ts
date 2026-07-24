import * as registry from "@/lib/forms/registry";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAdminAccess } from "@/lib/forms/forms-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  try {
    await ensureBootstrapped();
    return Response.json({
      forms: await registry.listForms(),
      activeSheetId: await registry.activeSheetId(),
      activeSourceId: await registry.activeSourceId(),
    });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
