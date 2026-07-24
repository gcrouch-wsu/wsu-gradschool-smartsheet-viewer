/**
 * Verify a Cloudflare Turnstile token server-side.
 * When FORMS_TURNSTILE_SECRET is unset, verification is skipped (dev-friendly).
 * When set, missing/invalid tokens fail closed.
 */
export async function verifyTurnstileToken(
  token: string | undefined,
  remoteip?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const secret = (process.env.FORMS_TURNSTILE_SECRET ?? "").trim();
  if (!secret) {
    return { ok: true };
  }
  if (!token?.trim()) {
    return { ok: false, error: "Please complete the captcha challenge." };
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token.trim());
  if (remoteip) body.set("remoteip", remoteip);

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!data.success) {
      return { ok: false, error: "Captcha verification failed. Please try again." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Captcha verification unavailable. Please try again." };
  }
}

export function turnstileSiteKey(): string {
  return (process.env.FORMS_TURNSTILE_SITE_KEY ?? "").trim();
}

export function isTurnstileConfigured(): boolean {
  return Boolean((process.env.FORMS_TURNSTILE_SECRET ?? "").trim());
}

/** Reject honeypot fills and suspiciously fast submits. */
export function checkPublicSpamGuards(input: {
  honeypot?: string;
  renderedAt?: number;
}): { ok: true } | { ok: false; error: string } {
  if (input.honeypot && input.honeypot.trim() !== "") {
    return { ok: false, error: "Submission rejected." };
  }
  if (typeof input.renderedAt === "number" && Number.isFinite(input.renderedAt)) {
    const elapsed = Date.now() - input.renderedAt;
    if (elapsed >= 0 && elapsed < 2000) {
      return { ok: false, error: "Please wait a moment and try again." };
    }
  }
  return { ok: true };
}
