import { defaultWorkflow, type Workflow } from "@/lib/forms/config";
import { ensureFormsTables, queryFormsDb } from "@/lib/forms/db";

const GLOBAL_SHEET_ID = "";

function normalizeSheetId(sheetId?: string): string {
  return sheetId?.trim() ? sheetId.trim() : GLOBAL_SHEET_ID;
}

export async function loadWorkflow(sheetId?: string): Promise<Workflow> {
  const key = normalizeSheetId(sheetId);
  const fallback = defaultWorkflow();

  await ensureFormsTables();
  const { rows } = await queryFormsDb<{ data: Workflow }>(
    "SELECT data FROM form_workflow_config WHERE sheet_id = $1",
    [key],
  );
  const row = rows[0];
  if (row?.data) {
    return { ...fallback, ...row.data };
  }
  if (key !== GLOBAL_SHEET_ID) {
    return loadWorkflow();
  }
  return fallback;
}

export async function saveWorkflow(workflow: Workflow, sheetId?: string): Promise<void> {
  const key = normalizeSheetId(sheetId);

  await ensureFormsTables();
  await queryFormsDb(
    `INSERT INTO form_workflow_config (sheet_id, data) VALUES ($1, $2)
     ON CONFLICT (sheet_id) DO UPDATE SET data = $2`,
    [key, JSON.stringify(workflow)],
  );
}
