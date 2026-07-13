import * as registry from "@/lib/forms/registry";
import { ensureBootstrapped } from "@/lib/forms/init";
import { requireFormsAdminAccess } from "@/lib/forms/forms-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  await ensureBootstrapped();
  const body = await request.json().catch(() => ({}));
  const id = String(body?.id ?? "");
  if (!(await registry.selectForm(id))) {
    return Response.json({ error: "That form is not in your list." }, { status: 404 });
  }
  return Response.json({ ok: true, activeSheetId: id });
}
