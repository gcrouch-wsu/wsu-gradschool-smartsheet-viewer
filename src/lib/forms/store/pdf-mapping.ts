import { ensureFormsTables, isFormsDatabaseEnabled, queryFormsDb } from "@/lib/forms/db";
import {
  defaultPdfMappingConfig,
  normalizePdfMappingConfig,
  type PdfMappingConfig,
  type PdfMappingRecord,
} from "@/lib/forms/pdf-mapping-types";
import {
  deletePdfMappingFile,
  deletePdfTemplateFile,
  readPdfMappingFile,
  readPdfTemplateFile,
  writePdfMappingFile,
  writePdfTemplateFile,
} from "@/lib/forms/store/file-store";

function assertSheetId(sheetId: string): string {
  const key = String(sheetId ?? "").trim();
  if (!key) {
    throw new Error("Sheet id is required.");
  }
  return key;
}

function asBuffer(value: unknown): Buffer | null {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value.length > 0 ? value : null;
  if (value instanceof Uint8Array) {
    return value.length > 0 ? Buffer.from(value) : null;
  }
  return null;
}

function toRecord(
  config: PdfMappingConfig,
  templateName: string | null,
  hasTemplate: boolean,
): PdfMappingRecord {
  return {
    config: normalizePdfMappingConfig(config),
    templateName: templateName?.trim() || null,
    hasTemplate,
  };
}

export async function loadPdfMapping(sheetId: string): Promise<PdfMappingRecord | null> {
  const key = assertSheetId(sheetId);

  if (isFormsDatabaseEnabled()) {
    await ensureFormsTables();
    const { rows } = await queryFormsDb<{
      data: PdfMappingConfig;
      template_name: string | null;
      has_template: boolean;
    }>(
      `SELECT data, template_name,
              (template IS NOT NULL AND octet_length(template) > 0) AS has_template
       FROM form_pdf_mapping WHERE sheet_id = $1`,
      [key],
    );
    const row = rows[0];
    if (!row) return null;
    return toRecord(row.data, row.template_name, Boolean(row.has_template));
  }

  const fromFile = await readPdfMappingFile(key);
  if (!fromFile) return null;
  const template = await readPdfTemplateFile(key);
  return toRecord(fromFile.config, fromFile.templateName, Boolean(template?.length));
}

export async function loadPdfTemplateBytes(sheetId: string): Promise<Buffer | null> {
  const key = assertSheetId(sheetId);

  if (isFormsDatabaseEnabled()) {
    await ensureFormsTables();
    const { rows } = await queryFormsDb<{ template: unknown }>(
      "SELECT template FROM form_pdf_mapping WHERE sheet_id = $1",
      [key],
    );
    return asBuffer(rows[0]?.template);
  }

  return readPdfTemplateFile(key);
}

export async function savePdfMappingConfig(
  sheetId: string,
  config: PdfMappingConfig,
): Promise<PdfMappingRecord> {
  const key = assertSheetId(sheetId);
  const normalized = normalizePdfMappingConfig(config);

  if (isFormsDatabaseEnabled()) {
    await ensureFormsTables();
    await queryFormsDb(
      `INSERT INTO form_pdf_mapping (sheet_id, data, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (sheet_id) DO UPDATE SET data = $2, updated_at = now()`,
      [key, JSON.stringify(normalized)],
    );
    const next = await loadPdfMapping(key);
    return next ?? toRecord(normalized, null, false);
  }

  const existing = await readPdfMappingFile(key);
  await writePdfMappingFile(key, {
    config: normalized,
    templateName: existing?.templateName ?? null,
  });
  const template = await readPdfTemplateFile(key);
  return toRecord(normalized, existing?.templateName ?? null, Boolean(template?.length));
}

export async function savePdfTemplate(
  sheetId: string,
  bytes: Buffer,
  templateName: string,
  seedConfig?: PdfMappingConfig,
): Promise<PdfMappingRecord> {
  const key = assertSheetId(sheetId);
  const name = String(templateName ?? "").trim() || "template.pdf";
  const existing = await loadPdfMapping(key);
  const config = normalizePdfMappingConfig(seedConfig ?? existing?.config ?? defaultPdfMappingConfig());

  if (isFormsDatabaseEnabled()) {
    await ensureFormsTables();
    await queryFormsDb(
      `INSERT INTO form_pdf_mapping (sheet_id, data, template, template_name, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (sheet_id) DO UPDATE SET
         data = $2,
         template = $3,
         template_name = $4,
         updated_at = now()`,
      [key, JSON.stringify(config), bytes, name],
    );
    return toRecord(config, name, bytes.length > 0);
  }

  await writePdfMappingFile(key, { config, templateName: name });
  await writePdfTemplateFile(key, bytes);
  return toRecord(config, name, bytes.length > 0);
}

/** Full replace used by duplicate — config + optional template bytes. */
export async function savePdfMappingFull(
  sheetId: string,
  config: PdfMappingConfig,
  template: Buffer | null,
  templateName: string | null,
): Promise<PdfMappingRecord> {
  const key = assertSheetId(sheetId);
  const normalized = normalizePdfMappingConfig(config);
  const name = templateName?.trim() || null;

  if (isFormsDatabaseEnabled()) {
    await ensureFormsTables();
    await queryFormsDb(
      `INSERT INTO form_pdf_mapping (sheet_id, data, template, template_name, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (sheet_id) DO UPDATE SET
         data = $2,
         template = $3,
         template_name = $4,
         updated_at = now()`,
      [key, JSON.stringify(normalized), template, name],
    );
    return toRecord(normalized, name, Boolean(template?.length));
  }

  await writePdfMappingFile(key, { config: normalized, templateName: name });
  if (template?.length) {
    await writePdfTemplateFile(key, template);
  } else {
    await deletePdfTemplateFile(key);
  }
  return toRecord(normalized, name, Boolean(template?.length));
}

export async function deletePdfMapping(sheetId: string): Promise<void> {
  const key = assertSheetId(sheetId);

  if (isFormsDatabaseEnabled()) {
    await ensureFormsTables();
    await queryFormsDb("DELETE FROM form_pdf_mapping WHERE sheet_id = $1", [key]);
    return;
  }

  await deletePdfMappingFile(key);
  await deletePdfTemplateFile(key);
}
