import { readFile } from "node:fs/promises";
import path from "node:path";
import { config, defaultWorkflow } from "@/lib/forms/config";
import { ensureFormsTables, isFormsDatabaseEnabled, queryFormsDb } from "@/lib/forms/db";
import * as registry from "@/lib/forms/registry";
import { saveConditionalRules } from "@/lib/forms/store/conditional-rules";
import { saveFormFields } from "@/lib/forms/store/field-config";
import { seedFileDefaultsIfMissing, type FormFieldsFile } from "@/lib/forms/store/file-store";
import { saveWorkflow } from "@/lib/forms/store/workflow-config";
import type { ConditionalRule } from "@/lib/forms/types";

const SEED_CONFIG_ROOT = path.join(process.cwd(), "smartsheet-wsu-form", "config");

let done = false;

function stripBom(value: string) {
  return value.replace(/^\uFEFF/, "");
}

async function readSeedJson<T>(fileName: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path.join(SEED_CONFIG_ROOT, fileName), "utf8");
    return JSON.parse(stripBom(raw)) as T;
  } catch {
    return fallback;
  }
}

async function isWorkflowConfigEmpty(): Promise<boolean> {
  if (isFormsDatabaseEnabled()) {
    await ensureFormsTables();
    const { rowCount } = await queryFormsDb("SELECT 1 FROM form_workflow_config LIMIT 1");
    return rowCount === 0;
  }

  const { readWorkflowFile } = await import("@/lib/forms/store/file-store");
  return !(await readWorkflowFile());
}

async function seedDefaultConfigFromPrototype(): Promise<void> {
  const workflow = {
    ...defaultWorkflow(),
    ...(await readSeedJson<Partial<typeof defaultWorkflow>>("workflow.json", {})),
  };
  const conditionalRules = await readSeedJson<ConditionalRule[]>("conditional-logic.json", []);
  const formFields = await readSeedJson<FormFieldsFile>("form-fields.json", {});

  if (isFormsDatabaseEnabled()) {
    if (await isWorkflowConfigEmpty()) {
      await saveWorkflow(workflow);
      await saveConditionalRules(Array.isArray(conditionalRules) ? conditionalRules : []);
      for (const [sheetId, fieldConfig] of Object.entries(formFields)) {
        if (fieldConfig?.columns?.length) {
          await saveFormFields(sheetId, fieldConfig);
        }
      }
    }
    return;
  }

  await seedFileDefaultsIfMissing(
    workflow,
    Array.isArray(conditionalRules) ? conditionalRules : [],
    formFields,
  );
}

async function seedRegistryFromEnv(): Promise<void> {
  if (config.demo) {
    return;
  }

  const envId = process.env.SMARTSHEET_SHEET_ID?.trim();
  if (!envId) {
    return;
  }

  const forms = await registry.listForms();
  if (forms.some((form) => form.id === envId)) {
    return;
  }

  await registry.ensureSeed({
    id: envId,
    name: "Imported sheet",
    createdAt: new Date().toISOString(),
    source: "imported",
  });
}

/** Seed forms config and registry once per server process. */
export async function ensureBootstrapped(): Promise<void> {
  if (done) {
    return;
  }
  done = true;

  await seedDefaultConfigFromPrototype();
  await seedRegistryFromEnv();
}
