import { config } from "@/lib/forms/config";
import * as ss from "@/lib/forms/smartsheet-api";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsApproverAccess } from "@/lib/forms/forms-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireFormsApproverAccess(request);
  if ("response" in access) return access.response;

  await ensureBootstrapped();

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return Response.json({ error: "Query parameter q is required." }, { status: 400 });

  try {
    const results = await ss.searchAll(q);
    return Response.json({ query: q, results, demo: config.demo });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
