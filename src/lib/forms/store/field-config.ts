import { ensureFormsTables, isFormsDatabaseEnabled, queryFormsDb } from "@/lib/forms/db";
import {
  readFormFieldsForSheet,
  writeFormFieldsForSheet,
  type FormFieldConfig,
} from "@/lib/forms/store/file-store";

export type { FormFieldConfig };

export async function loadFormFields(sheetId: string): Promise<FormFieldConfig | null> {
  if (!sheetId.trim()) {
    return null;
  }

  if (isFormsDatabaseEnabled()) {
    await ensureFormsTables();
    const { rows } = await queryFormsDb<{ data: FormFieldConfig }>(
      "SELECT data FROM form_field_config WHERE sheet_id = $1",
      [sheetId.trim()],
    );
    const row = rows[0];
    return row?.data ?? null;
  }

  return readFormFieldsForSheet(sheetId.trim());
}

export async function saveFormFields(sheetId: string, fieldConfig: FormFieldConfig): Promise<void> {
  if (!sheetId.trim()) {
    throw new Error("Sheet id is required.");
  }

  if (isFormsDatabaseEnabled()) {
    await ensureFormsTables();
    await queryFormsDb(
      `INSERT INTO form_field_config (sheet_id, data) VALUES ($1, $2)
       ON CONFLICT (sheet_id) DO UPDATE SET data = $2`,
      [sheetId.trim(), JSON.stringify(fieldConfig)],
    );
    return;
  }

  await writeFormFieldsForSheet(sheetId.trim(), fieldConfig);
}
