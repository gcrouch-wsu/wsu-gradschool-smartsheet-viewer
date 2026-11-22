import { ensureConfigTables, isDatabaseConfigEnabled, queryConfigDb } from "@/lib/config/config-db";
import {
  emptySesCounts,
  isSesEventKind,
  sesEventKind,
  type SesEventKind,
} from "@/lib/ses/events";
import { sesCorrelationIds, type ParsedSesEvent } from "@/lib/ses/parse";

export interface SesEventRecord {
  id: string;
  messageId: string;
  eventType: string;
  bounceType: string | null;
  kind: SesEventKind | null;
  recipientEmail: string;
  senderEmail: string | null;
  subject: string | null;
  outcome: string;
  occurredAt: string;
  payload: unknown;
}

export interface SesEventList {
  available: boolean;
  events: SesEventRecord[];
  counts: Record<SesEventKind, number>;
}

interface SesEventRow {
  id: string;
  message_id: string;
  event_type: string;
  bounce_type: string | null;
  recipient_email: string;
  sender_email: string | null;
  subject: string | null;
  outcome: string;
  occurred_at: Date | string;
  payload: unknown;
}

function mapRow(row: SesEventRow): SesEventRecord {
  const occurred = row.occurred_at instanceof Date ? row.occurred_at.toISOString() : new Date(row.occurred_at).toISOString();
  return {
    id: row.id,
    messageId: row.message_id,
    eventType: row.event_type,
    bounceType: row.bounce_type,
    kind: sesEventKind(row.event_type, row.bounce_type),
    recipientEmail: row.recipient_email,
    senderEmail: row.sender_email,
    subject: row.subject,
    outcome: row.outcome,
    occurredAt: occurred,
    payload: row.payload,
  };
}

function kindSql(kind: SesEventKind | null): { eventType: string | null; bounce: "permanent" | "other" | null } {
  if (!kind) return { eventType: null, bounce: null };
  if (kind === "hard_bounce") return { eventType: "Bounce", bounce: "permanent" };
  if (kind === "soft_bounce") return { eventType: "Bounce", bounce: "other" };
  const eventType = {
    send: "Send",
    rendering_failure: "Rendering Failure",
    reject: "Reject",
    delivery: "Delivery",
    complaint: "Complaint",
    delivery_delay: "DeliveryDelay",
    subscription: "Subscription",
  }[kind];
  return { eventType, bounce: null };
}

function searchPattern(query: string): string | null {
  const trimmed = query.trim().slice(0, 200);
  if (!trimmed) return null;
  return `%${trimmed.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export async function insertSesEvents(events: ParsedSesEvent[]): Promise<number> {
  if (!events.length || !isDatabaseConfigEnabled()) return 0;
  await ensureConfigTables();
  let inserted = 0;
  for (const event of events) {
    const result = await queryConfigDb(
      `INSERT INTO ses_events (
         message_id, event_type, bounce_type, recipient_email, sender_email, subject, outcome, occurred_at, payload
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       ON CONFLICT (message_id, event_type, recipient_email) DO NOTHING`,
      [
        event.messageId,
        event.eventType,
        event.bounceType,
        event.recipientEmail,
        event.senderEmail,
        event.subject,
        event.outcome,
        event.occurredAt,
        JSON.stringify(event.payload),
      ],
    );
    inserted += result.rowCount;
  }
  return inserted;
}

export interface DeliverySesNotice {
  messageId: string;
  eventType: string;
  bounceType: string | null;
  recipientEmail: string;
  outcome: string;
  occurredAt: string;
  correlationIds: string[];
}

/** SES notifications whose message id or headers match a workflow email. */
export async function listSesNoticesForIds(ids: string[]): Promise<DeliverySesNotice[]> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (!unique.length || !isDatabaseConfigEnabled()) return [];
  await ensureConfigTables();
  const { rows } = await queryConfigDb<SesEventRow>(
    `SELECT id, message_id, event_type, bounce_type, recipient_email, sender_email, subject, outcome, occurred_at, payload
     FROM ses_events
     WHERE message_id = ANY($1::text[])
        OR EXISTS (
          SELECT 1 FROM unnest($1::text[]) AS needle
          WHERE strpos(payload::text, needle) > 0
        )
     ORDER BY occurred_at ASC
     LIMIT 100`,
    [unique],
  );
  return rows.map((row) => {
    const mapped = mapRow(row);
    return {
      messageId: mapped.messageId,
      eventType: mapped.eventType,
      bounceType: mapped.bounceType,
      recipientEmail: mapped.recipientEmail,
      outcome: mapped.outcome,
      occurredAt: mapped.occurredAt,
      correlationIds: sesCorrelationIds(mapped.payload),
    };
  });
}

export async function listSesEvents(input: { kind?: string | null; query?: string | null }): Promise<SesEventList> {
  const counts = emptySesCounts();
  if (!isDatabaseConfigEnabled()) return { available: false, events: [], counts };
  await ensureConfigTables();

  const kind = input.kind && isSesEventKind(input.kind) ? input.kind : null;
  const filter = kindSql(kind);
  const pattern = searchPattern(input.query ?? "");

  const { rows: countRows } = await queryConfigDb<{ event_type: string; bounce_type: string | null; total: number }>(
    `SELECT event_type, bounce_type, COUNT(*)::int AS total
     FROM ses_events
     GROUP BY event_type, bounce_type`,
  );
  for (const row of countRows) {
    const rowKind = sesEventKind(row.event_type, row.bounce_type);
    if (rowKind) counts[rowKind] += Number(row.total) || 0;
  }

  const { rows } = await queryConfigDb<SesEventRow>(
    `SELECT id, message_id, event_type, bounce_type, recipient_email, sender_email, subject, outcome, occurred_at, payload
     FROM ses_events
     WHERE ($1::text IS NULL OR event_type = $1)
       AND (
         $2::text IS NULL
         OR ($2 = 'permanent' AND bounce_type = 'Permanent')
         OR ($2 = 'other' AND bounce_type IS DISTINCT FROM 'Permanent')
       )
       AND (
         $3::text IS NULL
         OR recipient_email ILIKE $3 ESCAPE '\\'
         OR sender_email ILIKE $3 ESCAPE '\\'
         OR message_id ILIKE $3 ESCAPE '\\'
         OR subject ILIKE $3 ESCAPE '\\'
       )
     ORDER BY occurred_at DESC
     LIMIT 200`,
    [filter.eventType, filter.bounce, pattern],
  );

  return { available: true, events: rows.map(mapRow), counts };
}
