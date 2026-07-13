import { ensureFormsTables, isFormsDatabaseEnabled, queryFormsDb } from "@/lib/forms/db";
import type { ConditionalRule } from "@/lib/forms/types";
import { readConditionalRulesFile, writeConditionalRulesFile } from "@/lib/forms/store/file-store";

const GLOBAL_SHEET_ID = "";

function normalizeSheetId(sheetId?: string): string {
  return sheetId?.trim() ? sheetId.trim() : GLOBAL_SHEET_ID;
}

export async function loadConditionalRules(sheetId?: string): Promise<ConditionalRule[]> {
  const key = normalizeSheetId(sheetId);

  if (isFormsDatabaseEnabled()) {
    await ensureFormsTables();
    const { rows } = await queryFormsDb<{ data: ConditionalRule[] }>(
      "SELECT data FROM form_conditional_rules WHERE sheet_id = $1",
      [key],
    );
    const row = rows[0];
    if (row?.data) {
      return Array.isArray(row.data) ? row.data : [];
    }
    if (key !== GLOBAL_SHEET_ID) {
      return loadConditionalRules();
    }
    return [];
  }

  const fromFile = await readConditionalRulesFile(key || undefined);
  return fromFile ?? [];
}

export async function saveConditionalRules(rules: ConditionalRule[], sheetId?: string): Promise<void> {
  const key = normalizeSheetId(sheetId);

  if (isFormsDatabaseEnabled()) {
    await ensureFormsTables();
    await queryFormsDb(
      `INSERT INTO form_conditional_rules (sheet_id, data) VALUES ($1, $2)
       ON CONFLICT (sheet_id) DO UPDATE SET data = $2`,
      [key, JSON.stringify(rules)],
    );
    return;
  }

  await writeConditionalRulesFile(rules, key || undefined);
}
