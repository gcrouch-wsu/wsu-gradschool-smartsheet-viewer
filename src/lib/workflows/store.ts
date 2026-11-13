import { ensureFormsTables, isFormsDatabaseEnabled, queryFormsDb } from "@/lib/forms/db";
import type { ViewFilterConfig } from "@/lib/config/types";
import { getWorkflowTemplate } from "@/lib/workflows/catalog";
import { isRunnableTemplateKind, type RunSource, type WorkflowAction, type WorkflowDeliveryRecord, type WorkflowRecord, type WorkflowRunRecord, type WorkflowTrigger, type TemplateKind } from "@/lib/workflows/types";
import { nextRetryAt } from "@/lib/workflows/retry-policy";

export function workflowsDatabaseAvailable(): boolean {
  return isFormsDatabaseEnabled();
}

function asTrigger(value: unknown): WorkflowTrigger {
  const raw = value && typeof value === "object" ? (value as WorkflowTrigger) : ({} as WorkflowTrigger);
  const event = raw.event === "row_created" || raw.event === "columns_changed" ? raw.event : "row_updated";
  return {
    event,
    columnIds: Array.isArray(raw.columnIds) ? raw.columnIds.map(Number).filter((id) => Number.isFinite(id)) : [],
    delivery: raw.delivery === "batched" ? "batched" : "immediate",
    schedule: raw.schedule,
  };
}

function asConditions(value: unknown): ViewFilterConfig[] {
  return Array.isArray(value) ? (value as ViewFilterConfig[]) : [];
}

function asAction(value: unknown): WorkflowAction {
  if (!value || typeof value !== "object") return { kind: "in_app_notification" };
  return value as WorkflowAction;
}

function mapRow(row: {
  id: string;
  sheet_id: string;
  name: string;
  enabled: boolean;
  template_kind: string;
  created_by_email: string | null;
  trigger: unknown;
  conditions: unknown;
  action: unknown;
  created_at: Date | string;
  updated_at: Date | string;
}): WorkflowRecord {
  return {
    id: row.id,
    sheetId: row.sheet_id,
    name: row.name,
    enabled: row.enabled,
    templateKind: row.template_kind as TemplateKind,
    createdByEmail: row.created_by_email,
    trigger: asTrigger(row.trigger),
    conditions: asConditions(row.conditions),
    action: asAction(row.action),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function listWorkflows(sheetId?: string): Promise<WorkflowRecord[]> {
  await ensureFormsTables();
  const { rows } = sheetId
    ? await queryFormsDb(
        `SELECT * FROM workflows WHERE sheet_id = $1 ORDER BY updated_at DESC`,
        [sheetId],
      )
    : await queryFormsDb(`SELECT * FROM workflows ORDER BY updated_at DESC`);
  return rows.map((row) => mapRow(row as never));
}

export async function getWorkflow(id: string): Promise<WorkflowRecord | null> {
  await ensureFormsTables();
  const { rows } = await queryFormsDb(`SELECT * FROM workflows WHERE id = $1`, [id]);
  const row = rows[0];
  return row ? mapRow(row as never) : null;
}

export async function listEnabledRunnableWorkflows(sheetId: string): Promise<WorkflowRecord[]> {
  const all = await listWorkflows(sheetId);
  return all.filter((workflow) => workflow.enabled && isRunnableTemplateKind(workflow.templateKind));
}

export interface SaveWorkflowInput {
  sheetId: string;
  name: string;
  enabled: boolean;
  templateKind: string;
  createdByEmail: string | null;
  trigger: WorkflowTrigger;
  conditions: ViewFilterConfig[];
  action: WorkflowAction;
}

export function validateWorkflowInput(input: SaveWorkflowInput): string | null {
  const template = getWorkflowTemplate(input.templateKind);
  if (!template) return "Unknown workflow template.";
  if (!input.name.trim()) return "Name is required.";
  if (!input.sheetId.trim()) return "A sheet is required.";
  if (input.enabled && !template.runnable) {
    return "This template cannot be enabled until a later plan.";
  }
  if (!input.enabled) return null;
  const emails = input.action.recipients?.userEmails ?? [];
  const contact = input.action.recipients?.contactColumnId;
  const needsPeople = ["alert", "request_update", "request_update_weekly", "request_approval", "assign_someone"];
  if (needsPeople.includes(input.templateKind) && emails.length === 0 && !contact) {
    return "Choose at least one person or a Contact column.";
  }
  const needsTitle = ["alert", "request_update", "request_update_weekly", "request_approval"];
  if (needsTitle.includes(input.templateKind) && !input.action.title?.trim()) {
    return "A notification title is required.";
  }
  if ((input.templateKind === "move_row" || input.templateKind === "copy_row") && !input.action.targetSheetId?.trim()) {
    return "Choose a destination sheet.";
  }
  const needsColumn = ["change_cell", "record_date", "assign_someone"];
  if (needsColumn.includes(input.templateKind) && !input.action.columnId) {
    return "Choose a column.";
  }
  if (input.templateKind === "change_cell" && !input.action.value?.trim()) {
    return "Enter a value.";
  }
  return null;
}

export async function createWorkflow(input: SaveWorkflowInput): Promise<WorkflowRecord> {
  const error = validateWorkflowInput(input);
  if (error) throw new Error(error);
  await ensureFormsTables();
  const { rows } = await queryFormsDb(
    `INSERT INTO workflows (sheet_id, name, enabled, template_kind, created_by_email, trigger, conditions, action)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      input.sheetId,
      input.name.trim(),
      input.enabled && isRunnableTemplateKind(input.templateKind),
      input.templateKind,
      input.createdByEmail,
      JSON.stringify(input.trigger),
      JSON.stringify(input.conditions ?? []),
      JSON.stringify(input.action),
    ],
  );
  return mapRow(rows[0] as never);
}

export async function updateWorkflow(id: string, input: SaveWorkflowInput): Promise<WorkflowRecord | null> {
  const error = validateWorkflowInput(input);
  if (error) throw new Error(error);
  await ensureFormsTables();
  const { rows } = await queryFormsDb(
    `UPDATE workflows
     SET sheet_id = $2,
         name = $3,
         enabled = $4,
         template_kind = $5,
         trigger = $6,
         conditions = $7,
         action = $8,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      input.sheetId,
      input.name.trim(),
      input.enabled && isRunnableTemplateKind(input.templateKind),
      input.templateKind,
      JSON.stringify(input.trigger),
      JSON.stringify(input.conditions ?? []),
      JSON.stringify(input.action),
    ],
  );
  const row = rows[0];
  return row ? mapRow(row as never) : null;
}

export async function deleteWorkflow(id: string): Promise<boolean> {
  await ensureFormsTables();
  const { rows } = await queryFormsDb(`DELETE FROM workflows WHERE id = $1 RETURNING id`, [id]);
  return rows.length > 0;
}

export async function insertWorkflowRun(input: {
  workflowId: string;
  sheetId: string;
  rowId: string | number | null;
  eventKey: string;
  status: string;
  error?: string | null;
  source?: RunSource;
}): Promise<{ id: string; attemptCount: number } | null> {
  await ensureFormsTables();
  const { rows } = await queryFormsDb(
    `INSERT INTO workflow_runs (workflow_id, sheet_id, row_id, event_key, status, error, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (workflow_id, event_key) DO NOTHING
     RETURNING id, attempt_count`,
    [input.workflowId, input.sheetId, input.rowId, input.eventKey, input.status, input.error ?? null, input.source ?? "webhook"],
  );
  const row = rows[0] as { id: string; attempt_count: number } | undefined;
  return row ? { id: row.id, attemptCount: Number(row.attempt_count ?? 1) } : null;
}

export async function updateWorkflowRun(id: string, status: string, error?: string | null): Promise<void> {
  await ensureFormsTables();
  await queryFormsDb(
    `UPDATE workflow_runs
     SET status = $2,
         error = $3,
         finished_at = CASE WHEN $2 IN ('sent', 'skipped') THEN now() ELSE finished_at END,
         next_retry_at = CASE WHEN $2 IN ('sent', 'skipped', 'waiting') THEN NULL ELSE next_retry_at END
     WHERE id = $1`,
    [id, status, error ?? null],
  );
}

export async function markWorkflowRunFailed(id: string, attemptCount: number, error: string): Promise<void> {
  await ensureFormsTables();
  await queryFormsDb(
    `UPDATE workflow_runs
     SET status = 'failed',
         error = $2,
         next_retry_at = $3,
         finished_at = CASE WHEN $3::timestamptz IS NULL THEN now() ELSE NULL END
     WHERE id = $1`,
    [id, error, nextRetryAt(attemptCount)],
  );
}

function mapRun(row: {
  id: string;
  workflow_id: string;
  sheet_id: string;
  row_id: string | null;
  event_key: string;
  status: string;
  error: string | null;
  source?: string | null;
  attempt_count?: number | null;
  next_retry_at?: Date | string | null;
  finished_at?: Date | string | null;
  created_at: Date | string;
}): WorkflowRunRecord {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    sheetId: row.sheet_id,
    rowId: row.row_id,
    eventKey: row.event_key,
    status: row.status,
    error: row.error,
    source: row.source ?? "webhook",
    attemptCount: Number(row.attempt_count ?? 1),
    nextRetryAt: row.next_retry_at ? new Date(row.next_retry_at).toISOString() : null,
    finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function listWorkflowRuns(workflowId: string, limit = 30): Promise<WorkflowRunRecord[]> {
  await ensureFormsTables();
  const { rows } = await queryFormsDb(
    `SELECT * FROM workflow_runs WHERE workflow_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [workflowId, limit],
  );
  return rows.map((row) => mapRun(row as never));
}

export async function getWorkflowRun(id: string): Promise<WorkflowRunRecord | null> {
  await ensureFormsTables();
  const { rows } = await queryFormsDb(`SELECT * FROM workflow_runs WHERE id = $1`, [id]);
  const row = rows[0];
  return row ? mapRun(row as never) : null;
}

export async function listRunDeliveries(runIds: string[]): Promise<WorkflowDeliveryRecord[]> {
  if (!runIds.length) return [];
  await ensureFormsTables();
  const { rows } = await queryFormsDb(
    `SELECT * FROM workflow_deliveries WHERE run_id = ANY($1::uuid[]) ORDER BY created_at`,
    [runIds],
  );
  return rows.map((row) => {
    const entry = row as {
      id: string;
      run_id: string;
      recipient_email: string;
      channel: string;
      status: string;
      error: string | null;
      created_at: Date | string;
    };
    return {
      id: entry.id,
      runId: entry.run_id,
      recipientEmail: entry.recipient_email,
      channel: entry.channel,
      status: entry.status,
      error: entry.error,
      createdAt: new Date(entry.created_at).toISOString(),
    };
  });
}

export async function insertWorkflowDeliveries(input: {
  runId: string;
  emails: string[];
  channel: string;
  status: string;
  error?: string | null;
}): Promise<void> {
  await ensureFormsTables();
  for (const email of input.emails) {
    await queryFormsDb(
      `INSERT INTO workflow_deliveries (run_id, recipient_email, channel, status, error)
       VALUES ($1, $2, $3, $4, $5)`,
      [input.runId, email, input.channel, input.status, input.error ?? null],
    );
  }
}

export async function listOpenFailures(sheetId: string): Promise<WorkflowRunRecord[]> {
  await ensureFormsTables();
  const { rows } = await queryFormsDb(
    `SELECT DISTINCT ON (workflow_id) *
     FROM workflow_runs
     WHERE sheet_id = $1 AND status = 'failed'
     ORDER BY workflow_id, created_at DESC`,
    [sheetId],
  );
  return rows.map((row) => mapRun(row as never));
}

export async function listAllEnabledWorkflows(): Promise<WorkflowRecord[]> {
  await ensureFormsTables();
  const { rows } = await queryFormsDb(`SELECT * FROM workflows WHERE enabled = true ORDER BY updated_at DESC`);
  return rows.map((row) => mapRow(row as never)).filter((workflow) => isRunnableTemplateKind(workflow.templateKind));
}

export async function claimDueRetries(): Promise<WorkflowRunRecord[]> {
  await ensureFormsTables();
  const { rows } = await queryFormsDb(
    `WITH due AS (
       SELECT id FROM workflow_runs
       WHERE status = 'failed' AND next_retry_at IS NOT NULL AND next_retry_at <= now()
       ORDER BY next_retry_at
       LIMIT 20
       FOR UPDATE SKIP LOCKED
     )
     UPDATE workflow_runs AS w
     SET status = 'pending', attempt_count = w.attempt_count + 1, next_retry_at = NULL
     FROM due
     WHERE w.id = due.id
     RETURNING w.*`,
  );
  return rows.map((row) => mapRun(row as never));
}

export async function hasScheduleRun(workflowId: string, dateKey: string): Promise<boolean> {
  await ensureFormsTables();
  const { rows } = await queryFormsDb(
    `SELECT id FROM workflow_runs WHERE workflow_id = $1 AND event_key = $2 LIMIT 1`,
    [workflowId, `schedule:${dateKey}`],
  );
  return rows.length > 0;
}

export async function enqueuePendingRow(workflowId: string, rowId: string | number): Promise<void> {
  await ensureFormsTables();
  await queryFormsDb(
    `INSERT INTO workflow_pending (workflow_id, row_id) VALUES ($1, $2)
     ON CONFLICT (workflow_id, row_id) DO UPDATE SET queued_at = now()`,
    [workflowId, String(rowId)],
  );
}

export async function takePendingRows(workflowId: string): Promise<string[]> {
  await ensureFormsTables();
  const { rows } = await queryFormsDb(
    `DELETE FROM workflow_pending WHERE workflow_id = $1 RETURNING row_id`,
    [workflowId],
  );
  return rows.map((row) => String((row as { row_id: string }).row_id));
}

export async function isWorkflowRowLocked(sheetId: string, rowId: string | number): Promise<boolean> {
  await ensureFormsTables();
  const { rows } = await queryFormsDb(
    `SELECT locked FROM workflow_row_locks WHERE sheet_id = $1 AND row_id = $2`,
    [String(sheetId), String(rowId)],
  );
  return Boolean((rows[0] as { locked?: boolean } | undefined)?.locked);
}

export async function setWorkflowRowLock(sheetId: string, rowId: string | number, locked: boolean): Promise<void> {
  await ensureFormsTables();
  await queryFormsDb(
    `INSERT INTO workflow_row_locks (sheet_id, row_id, locked)
     VALUES ($1, $2, $3)
     ON CONFLICT (sheet_id, row_id) DO UPDATE SET locked = EXCLUDED.locked, updated_at = now()`,
    [String(sheetId), String(rowId), locked],
  );
}

export async function recordWorkflowDecision(input: {
  runId: string;
  decision: "approved" | "declined";
  decidedBy: string;
  comment?: string | null;
}): Promise<void> {
  await ensureFormsTables();
  await queryFormsDb(
    `INSERT INTO workflow_decisions (run_id, decision, decided_by, comment) VALUES ($1, $2, $3, $4)`,
    [input.runId, input.decision, input.decidedBy, input.comment ?? null],
  );
}

export async function markRunNotificationsDecided(runId: string, decision: "approved" | "declined"): Promise<void> {
  await ensureFormsTables();
  await queryFormsDb(
    `UPDATE user_notifications
     SET payload = jsonb_set(COALESCE(payload, '{}'::jsonb), '{decision}', to_jsonb($2::text), true)
     WHERE run_id = $1`,
    [runId, decision],
  );
}
