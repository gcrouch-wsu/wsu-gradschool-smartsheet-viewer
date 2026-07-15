import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAccess } from "@/lib/forms/forms-api";
import * as registry from "@/lib/forms/registry";
import { parseSubmitBody, submitFormRows } from "@/lib/forms/form-service";
import { rateLimit } from "@/lib/forms/rate-limit";
import { getTrustedClientIp } from "@/lib/request-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const access = await requireFormsAccess(request);
  if ("response" in access) return access.response;

  await ensureBootstrapped();
  const ip = getTrustedClientIp(request.headers);

  if (!(await rateLimit(`submit:${ip}`))) {
    return Response.json({ error: "Too many submissions. Please wait a minute." }, { status: 429 });
  }

  const active = await registry.activeSheetId();
  if (!active) return Response.json({ error: "No form selected yet." }, { status: 409 });

  try {
    const { values, files } = await parseSubmitBody(request);
    const result = await submitFormRows(active, values, files);
    if (!result.ok) {
      return Response.json(
        result.errors.length === 1 ? { error: result.errors[0], errors: result.errors } : { errors: result.errors },
        { status: result.status },
      );
    }
    return Response.json({ ok: true, message: result.message, rowId: result.rowId });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
