import { formsAuthErrorResponse, requireFormsAccess } from "@/lib/forms/forms-api";
import { ensureBootstrapped } from "@/lib/forms/init";
import * as registry from "@/lib/forms/registry";
import { buildFormSchemaPayload } from "@/lib/forms/form-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireFormsAccess(request);
  if ("response" in access) return access.response;

  await ensureBootstrapped();
  const active = await registry.activeSheetId();
  if (!active) {
    return Response.json({ error: "No form selected yet. Open the admin page to create or pick one." }, { status: 409 });
  }

  try {
    const payload = await buildFormSchemaPayload(active);
    return Response.json(payload);
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
