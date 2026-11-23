import { ensureFormsTables, queryFormsDb } from "@/lib/forms/db";
import { publishWebhookEvent } from "@/lib/forms/webhook-bus";
import { randomBytes } from "node:crypto";

export interface WebhookState {
  lastEventId?: string;
  lastWebhookAt?: string;
  webhookId?: number;
  /** Sheet id this app last registered a webhook for. */
  sheetId?: string;
  /** Auto-generated or admin-managed secret for callback auth (env FORM_WEBHOOK_SECRET overrides). */
  webhookSecret?: string;
  /** Last registered Smartsheet callback URL (secret may be present as query param). */
  callbackUrl?: string;
  recentEvents: { at: string; type: string; objectId: number; sheetId?: number }[];
}

export type SyncState = WebhookState;

const DEFAULT_SHEET_KEY = "default";
const MAX_RECENT_EVENTS = 50;

function normalizeSheetKey(sheetId?: string | number): string {
  if (sheetId == null || String(sheetId).trim() === "") {
    return DEFAULT_SHEET_KEY;
  }
  return String(sheetId).trim();
}

async function loadStateFromDb(sheetKey: string): Promise<SyncState> {
  await ensureFormsTables();
  const { rows } = await queryFormsDb<{ data: SyncState }>(
    "SELECT data FROM form_webhook_state WHERE sheet_id = $1",
    [sheetKey],
  );
  const row = rows[0];
  const data = row?.data ?? {};
  return {
    ...data,
    recentEvents: data.recentEvents ?? [],
  };
}

async function saveStateToDb(sheetKey: string, state: SyncState): Promise<void> {
  await ensureFormsTables();
  await queryFormsDb(
    `INSERT INTO form_webhook_state (sheet_id, data) VALUES ($1, $2)
     ON CONFLICT (sheet_id) DO UPDATE SET data = $2`,
    [sheetKey, JSON.stringify(state)],
  );
}

async function loadState(sheetId?: string | number): Promise<SyncState> {
  return loadStateFromDb(normalizeSheetKey(sheetId));
}

async function saveState(sheetId: string | number | undefined, state: SyncState): Promise<void> {
  await saveStateToDb(normalizeSheetKey(sheetId), state);
}

async function insertWebhookEvent(
  sheetKey: string,
  eventType: string,
  objectId: number,
): Promise<void> {
  await ensureFormsTables();
  await queryFormsDb(
    `INSERT INTO form_webhook_events (sheet_id, event_type, object_id, occurred_at)
     VALUES ($1, $2, $3, now())`,
    [sheetKey === DEFAULT_SHEET_KEY ? null : sheetKey, eventType, objectId],
  );
}

export async function getSyncState(sheetId?: string | number): Promise<SyncState> {
  return loadState(sheetId);
}

export async function recordWebhookEvent(sheetId: number, eventType: string, objectId: number): Promise<void> {
  const sheetKey = normalizeSheetKey(sheetId);
  const current = await loadState(sheetId);
  const at = new Date().toISOString();
  const next: SyncState = {
    ...current,
    lastWebhookAt: at,
    recentEvents: [
      { at, type: eventType, objectId, sheetId },
      ...current.recentEvents,
    ].slice(0, MAX_RECENT_EVENTS),
  };

  await insertWebhookEvent(sheetKey, eventType, objectId);
  await saveState(sheetId, next);
  publishWebhookEvent({ at, sheetId, eventType, objectId });
}

export async function setLastEventId(id: string, sheetId?: string | number): Promise<void> {
  const current = await loadState(sheetId);
  await saveState(sheetId, { ...current, lastEventId: id });
}

export async function setWebhookId(id: number, sheetId?: string | number): Promise<void> {
  const current = await loadState(sheetId);
  await saveState(sheetId, { ...current, webhookId: id });
}

export async function setWebhookRegistration(input: {
  webhookId?: number;
  sheetId: string;
  callbackUrl: string;
}): Promise<void> {
  const current = await loadState();
  await saveState(undefined, {
    ...current,
    webhookId: input.webhookId ?? current.webhookId,
    sheetId: input.sheetId,
    callbackUrl: input.callbackUrl,
  });
}

/** Clear stored webhook id/callback when the matching Smartsheet webhook is deleted. */
export async function clearWebhookRegistration(webhookId: number): Promise<void> {
  const current = await loadState();
  if (current.webhookId != null && Number(current.webhookId) !== Number(webhookId)) return;
  await saveState(undefined, {
    ...current,
    webhookId: undefined,
    sheetId: undefined,
    callbackUrl: undefined,
  });
}

export async function setWebhookSecret(secret: string, sheetId?: string | number): Promise<void> {
  const current = await loadState(sheetId);
  await saveState(sheetId, { ...current, webhookSecret: secret });
}

export async function setWebhookCallbackUrl(callbackUrl: string, sheetId?: string | number): Promise<void> {
  const current = await loadState(sheetId);
  await saveState(sheetId, { ...current, callbackUrl });
}

/**
 * Ensure a persisted webhook secret exists (app-global under the default sync key).
 * Env FORM_WEBHOOK_SECRET always wins when set.
 */
export async function ensureWebhookSecret(): Promise<string> {
  const fromEnv = process.env.FORM_WEBHOOK_SECRET?.trim() ?? "";
  if (fromEnv) return fromEnv;

  const current = await loadState();
  if (current.webhookSecret?.trim()) return current.webhookSecret.trim();

  const secret = randomBytes(32).toString("hex");
  await saveState(undefined, { ...current, webhookSecret: secret });
  return secret;
}
