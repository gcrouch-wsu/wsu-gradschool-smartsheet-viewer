import { config, loadConditionalLogic } from "@/lib/forms/config";
import {
  isInternalFormColumn,
  isSystemFormColumn,
  resolveFormColumns,
  workflowExcludedTitles,
} from "@/lib/forms/form-fields";
import {
  deriveFormFieldConfig,
  fieldMetaFromConfig,
  mergeFieldsWithColumns,
} from "@/lib/forms/form-field-meta";
import type { FormFieldDefinition, FormFieldKindHint } from "@/lib/forms/form-field-config";
import { formsAuthErrorResponse, requireFormsAdminAccess } from "@/lib/forms/forms-api";
import { ensureBootstrapped } from "@/lib/forms/init";
import * as registry from "@/lib/forms/registry";
import { saveConditionalRules } from "@/lib/forms/store/conditional-rules";
import { loadFormFields, saveFormFields } from "@/lib/forms/store/field-config";
import * as ss from "@/lib/forms/smartsheet-api";
import type { ConditionalRule } from "@/lib/forms/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KIND_HINTS = new Set<FormFieldKindHint>(["text", "textarea", "email", "phone", "number"]);

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value;
}

async function resolveSheetId(request: Request): Promise<string | null> {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("sheetId")?.trim();
  if (fromQuery) return fromQuery;
  return registry.activeSheetId();
}

export async function GET(request: Request) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  await ensureBootstrapped();
  const sheetId = await resolveSheetId(request);
  if (!sheetId) {
    return Response.json({ error: "No form selected yet. Open Manage to create or pick one." }, { status: 409 });
  }

  try {
    const sheet = await ss.getSheet(sheetId);
    const columns = ss.extractColumns(sheet);
    const fieldConfig = await loadFormFields(sheetId);
    const workflowExclusions = [...(await workflowExcludedTitles(sheet))];
    const lockedTitles = new Set([
      ...workflowExclusions,
      ...columns.filter((c) => isSystemFormColumn(c) || isInternalFormColumn(c.title)).map((c) => c.title.toLowerCase()),
    ]);
    const fields = mergeFieldsWithColumns(columns, fieldConfig).map((field) =>
      lockedTitles.has(field.columnTitle.toLowerCase()) ? { ...field, hiddenOnForm: true } : field,
    );
    const conditionalLogic = await loadConditionalLogic(sheetId);
    const { columns: formColumns, source } = await resolveFormColumns(sheet, columns);
    const derived = deriveFormFieldConfig(fields, {
      formTitle: fieldConfig?.formTitle,
      formDescription: fieldConfig?.formDescription,
    });

    return Response.json({
      sheetId: String(sheet.id ?? sheetId),
      sheetName: sheet.name,
      formTitle: derived.formTitle ?? "",
      formDescription: derived.formDescription ?? "",
      columns,
      fields,
      fieldConfig: derived,
      fieldMeta: fieldMetaFromConfig(derived),
      formColumns,
      formColumnSource: source,
      conditionalLogic,
      workflowExclusions,
      lockedTitles: [...lockedTitles],
      demo: config.demo,
      attachmentsEnabled: config.attachmentsEnabled,
      allowedDomains: config.allowedDomains,
    });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}

export async function PUT(request: Request) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  await ensureBootstrapped();
  const sheetId = await resolveSheetId(request);
  if (!sheetId) {
    return Response.json({ error: "No form selected yet. Open Manage to create or pick one." }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const fields = Array.isArray(body.fields) ? (body.fields as FormFieldDefinition[]) : null;
  const conditionalLogic = Array.isArray(body.conditionalLogic) ? (body.conditionalLogic as ConditionalRule[]) : null;
  const hasFormTitle = Object.prototype.hasOwnProperty.call(body, "formTitle");
  const hasFormDescription = Object.prototype.hasOwnProperty.call(body, "formDescription");
  const formTitle = hasFormTitle ? asOptionalString(body.formTitle) : undefined;
  const formDescription = hasFormDescription ? asOptionalString(body.formDescription) : undefined;

  if (!fields && !conditionalLogic && !hasFormTitle && !hasFormDescription) {
    return Response.json({ error: "Provide fields, form title/description, and/or conditionalLogic." }, { status: 400 });
  }

  try {
    const existing = await loadFormFields(sheetId);

    if (fields || hasFormTitle || hasFormDescription) {
      const sheet = await ss.getSheet(sheetId);
      const columns = ss.extractColumns(sheet);
      const locked = new Set([
        ...(await workflowExcludedTitles(sheet)),
        ...columns.filter((c) => isSystemFormColumn(c) || isInternalFormColumn(c.title)).map((c) => c.title.toLowerCase()),
      ]);

      const sourceFields = fields ?? mergeFieldsWithColumns(columns, existing);
      const sanitized = sourceFields
        .map((f, index) => {
          const title = String(f.columnTitle ?? "").trim();
          const lockedField = locked.has(title.toLowerCase());
          const kindHint = KIND_HINTS.has(f.kindHint as FormFieldKindHint) ? (f.kindHint as FormFieldKindHint) : undefined;
          return {
            columnTitle: title,
            order: typeof f.order === "number" ? f.order : index,
            hiddenOnForm: lockedField ? true : Boolean(f.hiddenOnForm),
            label: typeof f.label === "string" ? f.label : undefined,
            helpText: typeof f.helpText === "string" ? f.helpText : undefined,
            required: typeof f.required === "boolean" ? f.required : undefined,
            kindHint,
          } satisfies FormFieldDefinition;
        })
        .filter((f) => f.columnTitle);

      await saveFormFields(
        sheetId,
        deriveFormFieldConfig(sanitized, {
          formTitle: hasFormTitle ? formTitle : existing?.formTitle,
          formDescription: hasFormDescription ? formDescription : existing?.formDescription,
        }),
      );
    }

    if (conditionalLogic) {
      const cleaned = conditionalLogic
        .map((rule) => ({
          whenColumn: String(rule.whenColumn ?? "").trim(),
          equals: Array.isArray(rule.equals) ? rule.equals.map((v) => String(v)).filter(Boolean) : [],
          showColumns: Array.isArray(rule.showColumns) ? rule.showColumns.map((v) => String(v)).filter(Boolean) : [],
        }))
        .filter((rule) => rule.whenColumn && rule.equals.length && rule.showColumns.length);
      await saveConditionalRules(cleaned, sheetId);
    }

    return Response.json({ ok: true, demo: config.demo });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
