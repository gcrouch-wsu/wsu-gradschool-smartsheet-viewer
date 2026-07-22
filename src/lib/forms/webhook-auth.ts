import { timingSafeEqual, createHash, randomBytes } from "node:crypto";
import { getSyncState } from "@/lib/forms/sync-state";

export const FORM_WEBHOOK_SECRET_ENV_VAR = "FORM_WEBHOOK_SECRET";

function getEnvWebhookSecret() {
  return process.env[FORM_WEBHOOK_SECRET_ENV_VAR]?.trim() ?? "";
}

function hashSecret(value: string) {
  return createHash("sha256").update(value).digest();
}

function secretsMatch(expected: string, provided: string): boolean {
  if (!expected || !provided) return false;
  const expectedBuf = hashSecret(expected);
  const providedBuf = hashSecret(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

function providedSecretFromRequest(request: Request): string {
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret") ?? "";
  const headerSecret = request.headers.get("x-forms-webhook-secret") ?? "";
  return querySecret || headerSecret;
}

export function generateWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}

/** True when an env secret is set, or a stored secret may exist (caller should still validate). */
export function isWebhookSecretConfigured() {
  return Boolean(getEnvWebhookSecret());
}

export async function resolveWebhookSecret(): Promise<string> {
  const fromEnv = getEnvWebhookSecret();
  if (fromEnv) return fromEnv;
  const state = await getSyncState();
  return state.webhookSecret?.trim() ?? "";
}

/**
 * Validate webhook auth against FORM_WEBHOOK_SECRET (preferred) or the persisted webhook secret.
 */
export async function validateWebhookSecret(request: Request): Promise<boolean> {
  const provided = providedSecretFromRequest(request);
  if (!provided) return false;

  const fromEnv = getEnvWebhookSecret();
  if (fromEnv) return secretsMatch(fromEnv, provided);

  const fromStore = (await getSyncState()).webhookSecret?.trim() ?? "";
  if (!fromStore) return false;
  return secretsMatch(fromStore, provided);
}
