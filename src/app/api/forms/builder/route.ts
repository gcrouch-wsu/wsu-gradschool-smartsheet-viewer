import { resolveAllowedDomains, resolveAttachmentsEnabled } from "@/lib/forms/allowed-domains";
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
import type { FormFieldDefinition, FormFieldKindHint, FormItemKind } from "@/lib/forms/form-field-config";
import { isLayoutFormItem } from "@/lib/forms/form-field-config";
import { auditFromPrincipal } from "@/lib/audit";
import { formsAuthErrorResponse, requireFormsAdminAccess } from "@/lib/forms/forms-api";
import { ensureBootstrapped } from "@/lib/forms/init";
import * as registry from "@/lib/forms/registry";
import { saveConditionalRules } from "@/lib/forms/store/conditional-rules";
import { loadFormFields, saveFormFields } from "@/lib/forms/store/field-config";
import * as ss from "@/lib/forms/smartsheet-api";
import type { ConditionalRule } from "@/lib/forms/types";
import { validateHeaderLogoPair } from "@/lib/header-logo";
import { resolveAdminPrincipal } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KIND_HINTS = new Set<FormFieldKindHint>([
  "text",
  "textarea",
  "email",
  "phone",
  "number",
  "multiselect",
  "select",
  "dropdown",
  "radio",
]);
const ITEM_KINDS = new Set<FormItemKind>(["field", "heading", "description", "divider"]);

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value;
}

function parseAllowedDomainsBody(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") {
    return value
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.map((d) => String(d).trim().toLowerCase()).filter(Boolean);
  }
  return undefined;
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
      allowedDomains: fieldConfig?.allowedDomains,
      attachmentsEnabled: fieldConfig?.attachmentsEnabled,
      headerLogoDataUrl: fieldConfig?.headerLogoDataUrl,
      headerLogoAlt: fieldConfig?.headerLogoAlt,
    });
    const formEntry = await registry.getFormById(sheetId);
    const resolvedDomains = resolveAllowedDomains(fieldConfig);
    const attachmentsEnabled = resolveAttachmentsEnabled(fieldConfig);

    return Response.json({
      sheetId: String(sheet.id ?? sheetId),
      sheetName: sheet.name,
      formTitle: derived.formTitle ?? "",
      formDescription: derived.formDescription ?? "",
      headerLogoDataUrl: derived.headerLogoDataUrl ?? "",
      headerLogoAlt: derived.headerLogoAlt ?? "",
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
      attachmentsEnabled,
      envAttachmentsEnabled: config.attachmentsEnabled,
      allowedDomains: resolvedDomains,
      formAllowedDomains: fieldConfig?.allowedDomains ?? [],
      envAllowedDomains: config.allowedDomains,
      formSlug: formEntry?.slug ?? "",
      formPublic: Boolean(formEntry?.public),
      publicUrl: formEntry?.public && formEntry.slug ? `/f/${formEntry.slug}` : null,
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
  const hasAllowedDomains = Object.prototype.hasOwnProperty.call(body, "allowedDomains");
  const hasAttachmentsEnabled = Object.prototype.hasOwnProperty.call(body, "attachmentsEnabled");
  const hasHeaderLogo = Object.prototype.hasOwnProperty.call(body, "headerLogoDataUrl");
  const formTitle = hasFormTitle ? asOptionalString(body.formTitle) : undefined;
  const formDescription = hasFormDescription ? asOptionalString(body.formDescription) : undefined;
  const allowedDomains = hasAllowedDomains ? parseAllowedDomainsBody(body.allowedDomains) : undefined;
  const attachmentsEnabled =
    hasAttachmentsEnabled && typeof body.attachmentsEnabled === "boolean"
      ? body.attachmentsEnabled
      : undefined;

  let nextHeaderLogoDataUrl: string | undefined;
  let nextHeaderLogoAlt: string | undefined;
  if (hasHeaderLogo) {
    const logoValidated = validateHeaderLogoPair(
      typeof body.headerLogoDataUrl === "string" ? body.headerLogoDataUrl : undefined,
      typeof body.headerLogoAlt === "string" ? body.headerLogoAlt : undefined,
    );
    if (!logoValidated.ok) {
      return Response.json({ error: logoValidated.errors[0] ?? "Invalid header logo." }, { status: 400 });
    }
    nextHeaderLogoDataUrl = logoValidated.dataUrl;
    nextHeaderLogoAlt = logoValidated.alt;
  }

  if (
    !fields &&
    !conditionalLogic &&
    !hasFormTitle &&
    !hasFormDescription &&
    !hasAllowedDomains &&
    !hasAttachmentsEnabled &&
    !hasHeaderLogo
  ) {
    return Response.json(
      {
        error:
          "Provide fields, form title/description, allowedDomains, attachmentsEnabled, header logo, and/or conditionalLogic.",
      },
      { status: 400 },
    );
  }

  try {
    const existing = await loadFormFields(sheetId);

    if (fields || hasFormTitle || hasFormDescription || hasAllowedDomains || hasAttachmentsEnabled || hasHeaderLogo) {
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
          const itemKind = ITEM_KINDS.has(f.itemKind as FormItemKind) ? (f.itemKind as FormItemKind) : "field";
          const layout = isLayoutFormItem({ itemKind });
          const lockedField = !layout && locked.has(title.toLowerCase());
          const kindHint = KIND_HINTS.has(f.kindHint as FormFieldKindHint) ? (f.kindHint as FormFieldKindHint) : undefined;
          const checkboxColumns = Array.isArray(f.checkboxColumns)
            ? f.checkboxColumns.map((t) => String(t).trim()).filter(Boolean)
            : undefined;
          const checkboxLabels = Array.isArray(f.checkboxLabels)
            ? f.checkboxLabels.map((t) => String(t))
            : undefined;
          return {
            columnTitle: title,
            order: index,
            itemKind,
            text: typeof f.text === "string" ? f.text : undefined,
            hiddenOnForm: lockedField ? true : Boolean(f.hiddenOnForm),
            label: typeof f.label === "string" ? f.label : undefined,
            helpText: typeof f.helpText === "string" ? f.helpText : undefined,
            required: layout ? undefined : typeof f.required === "boolean" ? f.required : undefined,
            kindHint: layout ? undefined : kindHint,
            checkboxColumns: layout ? undefined : checkboxColumns?.length ? checkboxColumns : undefined,
            checkboxLabels: layout ? undefined : checkboxLabels?.length ? checkboxLabels : undefined,
          } satisfies FormFieldDefinition;
        })
        .filter((f) => f.columnTitle);

      const nextDomains = hasAllowedDomains
        ? allowedDomains && allowedDomains.length > 0
          ? allowedDomains
          : undefined
        : existing?.allowedDomains;

      const nextAttachments = hasAttachmentsEnabled
        ? attachmentsEnabled
        : existing?.attachmentsEnabled;

      await saveFormFields(
        sheetId,
        deriveFormFieldConfig(sanitized, {
          formTitle: hasFormTitle ? formTitle : existing?.formTitle,
          formDescription: hasFormDescription ? formDescription : existing?.formDescription,
          allowedDomains: nextDomains,
          attachmentsEnabled: nextAttachments,
          headerLogoDataUrl: hasHeaderLogo ? nextHeaderLogoDataUrl : existing?.headerLogoDataUrl,
          headerLogoAlt: hasHeaderLogo ? nextHeaderLogoAlt : existing?.headerLogoAlt,
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

    const principal = await resolveAdminPrincipal();
    await auditFromPrincipal(principal, "forms.builder.save", "form", sheetId);

    return Response.json({ ok: true, demo: config.demo });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
