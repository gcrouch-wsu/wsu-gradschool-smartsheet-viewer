import { ensureFormsTables, isFormsDatabaseEnabled, queryFormsDb } from "@/lib/forms/db";
import type { ViewFilterConfig } from "@/lib/config/types";
import { getWorkflowTemplate } from "@/lib/workflows/catalog";
import { isRunnableTemplateKind, type WorkflowAction, type WorkflowRecord, type WorkflowTrigger, type TemplateKind } from "@/lib/workflows/types";

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
  if (input.enabled && input.templateKind === "alert") {
    const emails = input.action.recipients?.userEmails ?? [];
    const contact = input.action.recipients?.contactColumnId;
    if (emails.length === 0 && !contact) {
      return "Choose at least one person or a Contact column.";
    }
    if (!input.action.title?.trim()) return "A notification title is required.";
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
  rowId: number | null;
  eventKey: string;
  status: string;
  error?: string | null;
}): Promise<{ id: string } | null> {
  await ensureFormsTables();
  const { rows } = await queryFormsDb(
    `INSERT INTO workflow_runs (workflow_id, sheet_id, row_id, event_key, status, error)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (workflow_id, event_key) DO NOTHING
     RETURNING id`,
    [input.workflowId, input.sheetId, input.rowId, input.eventKey, input.status, input.error ?? null],
  );
  const row = rows[0] as { id: string } | undefined;
  return row ?? null;
}

export async function updateWorkflowRun(id: string, status: string, error?: string | null): Promise<void> {
  await ensureFormsTables();
  await queryFormsDb(`UPDATE workflow_runs SET status = $2, error = $3 WHERE id = $1`, [id, status, error ?? null]);
}
