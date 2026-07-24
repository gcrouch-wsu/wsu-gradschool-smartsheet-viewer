import * as ss from "@/lib/forms/smartsheet-api";
import * as registry from "@/lib/forms/registry";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAdminAccess } from "@/lib/forms/forms-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  try {
    await ensureBootstrapped();
    const body = await request.json().catch(() => ({}));
    const id = String(body?.id ?? "").trim();
    if (!id) return Response.json({ error: "Select a sheet from the list." }, { status: 400 });

    const name = String((await ss.getSheet(id)).name ?? "Imported sheet");
    await registry.registerForm({ id, name, createdAt: new Date().toISOString(), source: "imported" }, true);
    return Response.json({ ok: true, sheet: { id, name } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (message.includes("Could not find") || (typeof e === "object" && e && "status" in e && Number((e as { status: number }).status) === 404)) {
      return Response.json({ error: "Could not find that sheet — check the ID (and your token)." }, { status: 404 });
    }
    return formsAuthErrorResponse(e);
  }
}
