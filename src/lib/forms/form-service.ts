import { resolveAllowedDomains, resolveAttachmentsEnabled } from "@/lib/forms/allowed-domains";
import { config, loadConditionalLogic } from "@/lib/forms/config";
import { expandColumnsWithCheckboxGroups, fieldMetaFromConfig } from "@/lib/forms/form-field-meta";
import { resolveFormColumns } from "@/lib/forms/form-fields";
import { loadFormFields } from "@/lib/forms/store/field-config";
import * as ss from "@/lib/forms/smartsheet-api";
import { validateSubmission, type SubmissionCell } from "@/lib/forms/validation";

export interface FormSchemaPayload {
  sheetName: string;
  formTitle: string;
  formDescription: string;
  formItems: unknown[];
  columns: unknown[];
  formColumnSource: string;
  fieldMeta: ReturnType<typeof fieldMetaFromConfig>;
  conditionalLogic: Awaited<ReturnType<typeof loadConditionalLogic>>;
  allowedDomains: string[];
  demo: boolean;
  attachmentsEnabled: boolean;
}

export async function buildFormSchemaPayload(sheetId: string): Promise<FormSchemaPayload> {
  const sheet = await ss.getSheet(sheetId);
  const extracted = ss.extractColumns(sheet);
  const { columns: formColumns, source: formColumnSource } = await resolveFormColumns(sheet, extracted);
  const fieldConfig = await loadFormFields(sheetId);
  const columns = expandColumnsWithCheckboxGroups(formColumns, extracted, fieldConfig);
  const fieldMeta = fieldMetaFromConfig(fieldConfig);
  const conditionalLogic = await loadConditionalLogic(sheetId);
  const allowedDomains = resolveAllowedDomains(fieldConfig);
  const attachmentsEnabled = resolveAttachmentsEnabled(fieldConfig);

  return {
    sheetName: String(sheet.name ?? "Form"),
    formTitle: fieldConfig?.formTitle ?? "",
    formDescription: fieldConfig?.formDescription ?? "",
    formItems: (fieldConfig?.fields ?? []).filter((f) => !f.hiddenOnForm),
    columns,
    formColumnSource,
    fieldMeta,
    conditionalLogic,
    allowedDomains,
    demo: config.demo,
    attachmentsEnabled,
  };
}

export interface SubmitFilesInput {
  name: string;
  blob: Blob;
}

export function extOfFilename(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export async function parseSubmitBody(request: Request): Promise<{
  values: Record<string, string>;
  files: SubmitFilesInput[];
  honeypot?: string;
  turnstileToken?: string;
  renderedAt?: number;
}> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data")) {
    const form = await request.formData();
    const valuesRaw = form.get("values");
    const values = valuesRaw ? (JSON.parse(String(valuesRaw)) as Record<string, string>) : {};
    const files: SubmitFilesInput[] = [];
    for (const [key, val] of form.entries()) {
      if (key.startsWith("file") && val instanceof Blob) {
        const name = (val as File).name || "upload";
        files.push({ name, blob: val });
      }
    }
    const honeypot = form.get("website");
    const turnstileToken = form.get("cf-turnstile-response") ?? form.get("turnstileToken");
    const renderedAtRaw = form.get("renderedAt");
    return {
      values,
      files,
      honeypot: honeypot != null ? String(honeypot) : undefined,
      turnstileToken: turnstileToken != null ? String(turnstileToken) : undefined,
      renderedAt: renderedAtRaw != null ? Number(renderedAtRaw) : undefined,
    };
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  return {
    values: (body.values as Record<string, string>) ?? {},
    files: [],
    honeypot: typeof body.website === "string" ? body.website : undefined,
    turnstileToken: typeof body.turnstileToken === "string" ? body.turnstileToken : undefined,
    renderedAt: typeof body.renderedAt === "number" ? body.renderedAt : undefined,
  };
}

export function validateAttachmentFiles(
  files: SubmitFilesInput[],
  attachmentsEnabled: boolean,
): string | null {
  if (files.length && !attachmentsEnabled) {
    return "File uploads are disabled.";
  }
  for (const f of files) {
    const e = extOfFilename(f.name);
    if (config.allowedAttachmentTypes.length && !config.allowedAttachmentTypes.includes(e)) {
      return `File type .${e} is not allowed.`;
    }
    if (f.blob.size > config.maxAttachmentMb * 1024 * 1024) {
      return `File ${f.name} exceeds ${config.maxAttachmentMb}MB limit.`;
    }
  }
  return null;
}

export async function submitFormRows(
  sheetId: string,
  values: Record<string, string>,
  files: SubmitFilesInput[],
): Promise<{ ok: true; message: string; rowId: number | null } | { ok: false; errors: string[]; status: number }> {
  const fieldConfig = await loadFormFields(sheetId);
  const attachmentsEnabled = resolveAttachmentsEnabled(fieldConfig);
  const attachmentError = validateAttachmentFiles(files, attachmentsEnabled);
  if (attachmentError) {
    return { ok: false, errors: [attachmentError], status: 400 };
  }

  const sheet = await ss.getSheet(sheetId);
  const extracted = ss.extractColumns(sheet);
  const { columns: formColumns } = await resolveFormColumns(sheet, extracted);
  const columns = expandColumnsWithCheckboxGroups(formColumns, extracted, fieldConfig);
  const conditionalLogic = await loadConditionalLogic(sheetId);
  const fieldMeta = fieldMetaFromConfig(fieldConfig);
  const allowedDomains = resolveAllowedDomains(fieldConfig);
  const result = validateSubmission(columns, values, conditionalLogic, fieldMeta, allowedDomains);
  if (!result.ok) {
    return { ok: false, errors: result.errors, status: 422 };
  }

  const addResult = (await ss.addRow(sheetId, result.cells as SubmissionCell[])) as {
    result?: { id?: number } | { id?: number }[];
  };
  const rowId = Array.isArray(addResult?.result) ? addResult.result[0]?.id : addResult?.result?.id;

  if (files.length && rowId) {
    for (const f of files) {
      await ss.attachFile(sheetId, rowId, f.blob, f.name);
    }
  }

  return { ok: true, message: "Submitted — thank you.", rowId: rowId ?? null };
}
