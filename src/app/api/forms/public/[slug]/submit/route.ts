import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse } from "@/lib/forms/forms-api";
import { parseSubmitBody, submitFormRows } from "@/lib/forms/form-service";
import { rateLimit } from "@/lib/forms/rate-limit";
import * as registry from "@/lib/forms/registry";
import { checkPublicSpamGuards, verifyTurnstileToken } from "@/lib/forms/turnstile";
import { getTrustedClientIp } from "@/lib/request-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  await ensureBootstrapped();
  const { slug } = await params;
  const ip = getTrustedClientIp(request.headers);

  if (!(await rateLimit(`submit:public:${slug}:${ip}`, 3, 60_000))) {
    return Response.json({ error: "Too many submissions. Please wait a minute." }, { status: 429 });
  }

  try {
    const form = await registry.getPublishedFormBySlug(slug);
    if (!form) {
      return Response.json({ error: "Form not found or not published." }, { status: 404 });
    }

    const { values, files, honeypot, turnstileToken, renderedAt } = await parseSubmitBody(request);

    const spam = checkPublicSpamGuards({ honeypot, renderedAt });
    if (!spam.ok) {
      return Response.json({ error: spam.error }, { status: 400 });
    }

    const captcha = await verifyTurnstileToken(turnstileToken, ip);
    if (!captcha.ok) {
      return Response.json({ error: captcha.error }, { status: 400 });
    }

    const result = await submitFormRows(form.id, values, files);
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
