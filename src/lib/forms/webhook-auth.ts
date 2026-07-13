import { timingSafeEqual, createHash } from "node:crypto";

export const FORM_WEBHOOK_SECRET_ENV_VAR = "FORM_WEBHOOK_SECRET";

function getWebhookSecret() {
  return process.env[FORM_WEBHOOK_SECRET_ENV_VAR]?.trim() ?? "";
}

function hashSecret(value: string) {
  return createHash("sha256").update(value).digest();
}

export function isWebhookSecretConfigured() {
  return Boolean(getWebhookSecret());
}

export function validateWebhookSecret(request: Request): boolean {
  const expected = getWebhookSecret();
  if (!expected) return false;

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret") ?? "";
  const headerSecret = request.headers.get("x-forms-webhook-secret") ?? "";
  const provided = querySecret || headerSecret;
  if (!provided) return false;

  const expectedBuf = hashSecret(expected);
  const providedBuf = hashSecret(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}
