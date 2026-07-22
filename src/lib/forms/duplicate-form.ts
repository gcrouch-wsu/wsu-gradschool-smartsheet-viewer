import * as ss from "@/lib/forms/smartsheet-api";
import * as registry from "@/lib/forms/registry";
import { loadFormFields, saveFormFields } from "@/lib/forms/store/field-config";
import { loadConditionalRules, saveConditionalRules } from "@/lib/forms/store/conditional-rules";
import { loadWorkflow, saveWorkflow } from "@/lib/forms/store/workflow-config";
import type { FormEntry } from "@/lib/forms/registry";
import type { FormFieldConfig } from "@/lib/forms/form-field-config";
import type { ConditionalRule } from "@/lib/forms/types";
import type { Workflow } from "@/lib/forms/config";

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function defaultCopyName(sourceName: string): string {
  const base = sourceName.trim() || "Form";
  if (/\(copy\)\s*$/i.test(base)) return `${base} ${Date.now().toString().slice(-4)}`;
  return `${base} (copy)`;
}

export type DuplicateFormResult = {
  form: FormEntry;
  sheet: { id: string; name: string };
  note: string;
  copied: {
    fields: boolean;
    conditionalRules: boolean;
    workflow: boolean;
  };
};

/**
 * Clone a registered form: Smartsheet sheet (structure + rules) plus builder configs.
 * New form is always unpublished with a unique slug.
 */
export async function duplicateForm(
  sourceSheetId: string,
  options?: { newName?: string; destinationFolderId?: string | number; makeActive?: boolean },
): Promise<DuplicateFormResult> {
  const sourceId = String(sourceSheetId).trim();
  if (!sourceId) {
    throw Object.assign(new Error("Source form id is required."), { status: 400 });
  }

  const source = await registry.getFormById(sourceId);
  if (!source) {
    throw Object.assign(new Error("Form not found."), { status: 404 });
  }

  const name = (options?.newName && String(options.newName).trim()) || defaultCopyName(source.name);
  const include = ["forms", "rules", "ruleRecipients", "filters"];
  let note = "";
  let sheet: { id: number | string; name: string };

  try {
    sheet = (
      (await ss.copySheetToFolder(sourceId, name, include, options?.destinationFolderId)) as {
        result: { id: number | string; name: string };
      }
    ).result;
  } catch {
    sheet = (
      (await ss.copySheetToFolder(
        sourceId,
        name,
        ["rules", "ruleRecipients", "filters"],
        options?.destinationFolderId,
      )) as { result: { id: number | string; name: string } }
    ).result;
    note =
      "Cloned without the native Smartsheet form (forms include failed on this account); columns and rules were carried over.";
  }

  const newId = String(sheet.id);
  await registry.registerForm(
    {
      id: newId,
      name: sheet.name || name,
      createdAt: new Date().toISOString(),
      source: "template",
      public: false,
      publishedAt: undefined,
    },
    options?.makeActive !== false,
  );

  const copied = { fields: false, conditionalRules: false, workflow: false };

  const fields = await loadFormFields(sourceId);
  if (fields) {
    const nextFields = deepClone(fields) as FormFieldConfig;
    // Keep public form title in sync with the new sheet name when it still matched the old sheet.
    if (!nextFields.formTitle?.trim() || nextFields.formTitle.trim() === source.name.trim()) {
      nextFields.formTitle = name;
    }
    await saveFormFields(newId, nextFields);
    copied.fields = true;
  }

  const rules = await loadConditionalRules(sourceId);
  if (Array.isArray(rules) && rules.length > 0) {
    await saveConditionalRules(deepClone(rules) as ConditionalRule[], newId);
    copied.conditionalRules = true;
  }

  const workflow = await loadWorkflow(sourceId);
  if (workflow) {
    await saveWorkflow(deepClone(workflow) as Workflow, newId);
    copied.workflow = true;
  }

  const form = (await registry.getFormById(newId)) ?? {
    id: newId,
    name: sheet.name || name,
    createdAt: new Date().toISOString(),
    source: "template" as const,
    public: false,
  };

  return {
    form,
    sheet: { id: newId, name: sheet.name || name },
    note,
    copied,
  };
}
