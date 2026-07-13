import { ensureFormsTables, isFormsDatabaseEnabled, queryFormsDb } from "@/lib/forms/db";
import { normalizeFormFieldConfig, type FormFieldConfig } from "@/lib/forms/form-field-config";
import { readFormFieldsForSheet, writeFormFieldsForSheet } from "@/lib/forms/store/file-store";

export type { FormFieldConfig, FormFieldDefinition, FormFieldKindHint } from "@/lib/forms/form-field-config";
export { normalizeFormFieldConfig };

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
    return row?.data ? normalizeFormFieldConfig(row.data) : null;
  }

  const fromFile = await readFormFieldsForSheet(sheetId.trim());
  return fromFile ? normalizeFormFieldConfig(fromFile) : null;
}

export async function saveFormFields(sheetId: string, fieldConfig: FormFieldConfig): Promise<void> {
  if (!sheetId.trim()) {
    throw new Error("Sheet id is required.");
  }

  const normalized = normalizeFormFieldConfig(fieldConfig);

  if (isFormsDatabaseEnabled()) {
    await ensureFormsTables();
    await queryFormsDb(
      `INSERT INTO form_field_config (sheet_id, data) VALUES ($1, $2)
       ON CONFLICT (sheet_id) DO UPDATE SET data = $2`,
      [sheetId.trim(), JSON.stringify(normalized)],
    );
    return;
  }

  await writeFormFieldsForSheet(sheetId.trim(), normalized);
}
