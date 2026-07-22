import { config } from "@/lib/forms/config";
import { ensureFormsTables, isFormsDatabaseEnabled, queryFormsDb } from "@/lib/forms/db";
import { readWebhookState, writeWebhookState, type WebhookState } from "@/lib/forms/store/file-store";
import { publishWebhookEvent } from "@/lib/forms/webhook-bus";
import { randomBytes } from "node:crypto";

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
  if (config.demo) {
    return { recentEvents: [] };
  }

  const sheetKey = normalizeSheetKey(sheetId);
  if (isFormsDatabaseEnabled()) {
    return loadStateFromDb(sheetKey);
  }
  return readWebhookState(sheetKey);
}

async function saveState(sheetId: string | number | undefined, state: SyncState): Promise<void> {
  if (config.demo) return;

  const sheetKey = normalizeSheetKey(sheetId);
  if (isFormsDatabaseEnabled()) {
    await saveStateToDb(sheetKey, state);
    return;
  }
  await writeWebhookState(state, sheetKey);
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

  if (isFormsDatabaseEnabled() && !config.demo) {
    await insertWebhookEvent(sheetKey, eventType, objectId);
  }

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
