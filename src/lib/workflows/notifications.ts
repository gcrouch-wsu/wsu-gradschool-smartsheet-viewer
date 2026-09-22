import { ensureFormsTables, queryFormsDb } from "@/lib/forms/db";
import { normalizeEmail } from "@/lib/workflows/recipients";
import type { NotificationPayload } from "@/lib/workflows/types";

export interface UserNotification {
  id: string;
  recipientEmail: string;
  title: string;
  body: string;
  payload: NotificationPayload;
  workflowId: string | null;
  runId: string | null;
  readAt: string | null;
  createdAt: string;
}

function mapNotification(row: {
  id: string;
  recipient_email: string;
  title: string;
  body: string;
  payload: NotificationPayload;
  workflow_id: string | null;
  run_id: string | null;
  read_at: Date | string | null;
  created_at: Date | string;
}): UserNotification {
  return {
    id: row.id,
    recipientEmail: row.recipient_email,
    title: row.title,
    body: row.body,
    payload: row.payload ?? { sheetId: "", rowId: null, fields: [], templateKind: "alert" },
    workflowId: row.workflow_id,
    runId: row.run_id,
    readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function insertNotifications(input: {
  emails: string[];
  title: string;
  body: string;
  payload: NotificationPayload;
  workflowId: string;
  runId: string;
}): Promise<number> {
  const emails = [...new Set(input.emails.map((email) => normalizeEmail(email)).filter((email): email is string => Boolean(email)))];
  if (!emails.length) return 0;
  await ensureFormsTables();
  let created = 0;
  for (const email of emails) {
    await queryFormsDb(
      `INSERT INTO user_notifications (recipient_email, title, body, payload, workflow_id, run_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [email, input.title, input.body, JSON.stringify(input.payload), input.workflowId, input.runId],
    );
    created += 1;
  }
  return created;
}

export async function listNotificationsForEmail(email: string, limit = 50): Promise<{ items: UserNotification[]; unreadCount: number }> {
  const normalized = normalizeEmail(email);
  if (!normalized) return { items: [], unreadCount: 0 };
  await ensureFormsTables();
  const { rows } = await queryFormsDb(
    `SELECT * FROM user_notifications
     WHERE recipient_email = $1
     ORDER BY (read_at IS NULL) DESC, created_at DESC
     LIMIT $2`,
    [normalized, limit],
  );
  const items = rows.map((row) => mapNotification(row as never));
  const count = await queryFormsDb(
    `SELECT count(*)::int AS count FROM user_notifications WHERE recipient_email = $1 AND read_at IS NULL`,
    [normalized],
  );
  const unreadCount = Number((count.rows[0] as { count?: number } | undefined)?.count ?? 0);
  return { items, unreadCount };
}

export async function markNotificationRead(id: string, email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  await ensureFormsTables();
  const { rows } = await queryFormsDb(
    `UPDATE user_notifications
     SET read_at = COALESCE(read_at, now())
     WHERE id = $1 AND recipient_email = $2
     RETURNING id`,
    [id, normalized],
  );
  return rows.length > 0;
}

export async function listKnownEmails(limit = 200): Promise<string[]> {
  await ensureFormsTables();
  const { rows } = await queryFormsDb(
    `SELECT email FROM (
       SELECT lower(username) AS email FROM admin_users WHERE username LIKE '%@%' AND is_active = true
       UNION
       SELECT lower(email) AS email FROM contributor_users
       UNION
       SELECT lower(email) AS email FROM student_users
       UNION
       SELECT lower(email) AS email FROM form_approver_users
     ) people
     WHERE email LIKE '%@%'
     ORDER BY email
     LIMIT $1`,
    [limit],
  );
  return rows
    .map((row) => normalizeEmail(String((row as { email?: string }).email ?? "")))
    .filter((email): email is string => Boolean(email));
}
