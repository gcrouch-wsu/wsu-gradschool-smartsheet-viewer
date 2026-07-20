import { ensureFormsTables, isFormsDatabaseEnabled, queryFormsDb } from "@/lib/forms/db";
import { normalizeFormFieldConfig, type FormFieldConfig } from "@/lib/forms/form-field-config";
import { readFormFieldsForSheet, writeFormFieldsForSheet } from "@/lib/forms/store/file-store";

export type { FormFieldConfig, FormFieldDefinition, FormFieldKindHint } from "@/lib/forms/form-field-config";
export { normalizeFormFieldConfig };

/** Undo prior auto-hide of role name/email columns used for Path A routing. */
function restoreRoutingContactFields(config: FormFieldConfig): FormFieldConfig {
  if (!config.fields?.length) return config;
  let changed = false;
  const fields = config.fields.map((field) => {
    if (
      /^(academic coordinator|chr|chair)\s+(name|email)\b/i.test(field.columnTitle) &&
      field.hiddenOnForm
    ) {
      changed = true;
      return { ...field, hiddenOnForm: false };
    }
    return field;
  });
  return changed ? { ...config, fields } : config;
}

export async function loadFormFields(sheetId: string): Promise<FormFieldConfig | null> {
  if (!sheetId.trim()) {
    return null;
  }

  let loaded: FormFieldConfig | null = null;

  if (isFormsDatabaseEnabled()) {
    await ensureFormsTables();
    const { rows } = await queryFormsDb<{ data: FormFieldConfig }>(
      "SELECT data FROM form_field_config WHERE sheet_id = $1",
      [sheetId.trim()],
    );
    const row = rows[0];
    loaded = row?.data ? normalizeFormFieldConfig(row.data) : null;
  } else {
    const fromFile = await readFormFieldsForSheet(sheetId.trim());
    loaded = fromFile ? normalizeFormFieldConfig(fromFile) : null;
  }

  return loaded ? restoreRoutingContactFields(loaded) : null;
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
