import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse } from "@/lib/forms/forms-api";
import { buildFormSchemaPayload } from "@/lib/forms/form-service";
import * as registry from "@/lib/forms/registry";
import { isTurnstileConfigured, turnstileSiteKey } from "@/lib/forms/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  await ensureBootstrapped();
  const { slug } = await params;

  try {
    const form = await registry.getPublishedFormBySlug(slug);
    if (!form) {
      return Response.json({ error: "Form not found or not published." }, { status: 404 });
    }

    const payload = await buildFormSchemaPayload(form.id);
    return Response.json({
      ...payload,
      formId: form.id,
      formSlug: form.slug,
      turnstileSiteKey: turnstileSiteKey() || undefined,
      turnstileRequired: isTurnstileConfigured(),
    });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
