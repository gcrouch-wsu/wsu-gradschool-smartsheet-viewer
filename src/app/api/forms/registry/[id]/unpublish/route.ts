import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAdminAccess } from "@/lib/forms/forms-api";
import * as registry from "@/lib/forms/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  await ensureBootstrapped();
  const { id } = await params;

  try {
    const form = await registry.unpublishForm(id);
    return Response.json({ ok: true, form });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
