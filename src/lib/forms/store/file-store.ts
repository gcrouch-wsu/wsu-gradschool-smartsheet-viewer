import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FormFieldConfig } from "@/lib/forms/form-field-config";
import type { ConditionalRule } from "@/lib/forms/types";
import type { Workflow } from "@/lib/forms/config";

export type { FormFieldConfig, FormFieldDefinition, FormFieldKindHint } from "@/lib/forms/form-field-config";
export { normalizeFormFieldConfig } from "@/lib/forms/form-field-config";

const FORMS_CONFIG_ROOT = path.join(process.cwd(), "config", "forms");

const REGISTRY_FILE = "registry.json";
const WORKFLOW_FILE = "workflow.json";
const FORM_FIELDS_FILE = "form-fields.json";
const CONDITIONAL_LOGIC_FILE = "conditional-logic.json";
const WEBHOOK_STATE_FILE = "webhook-state.json";

const MAX_SHEET_ID_LEN = 64;
const SAFE_SHEET_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

function stripBom(value: string) {
  return value.replace(/^\uFEFF/, "");
}

function assertSafeSheetId(sheetId: string) {
  if (!sheetId) {
    throw new Error("Sheet id is required.");
  }
  if (sheetId.length > MAX_SHEET_ID_LEN) {
    throw new Error(`Sheet id is too long (max ${MAX_SHEET_ID_LEN} characters).`);
  }
  if (!SAFE_SHEET_ID.test(sheetId)) {
    throw new Error("Sheet id may only contain letters, numbers, hyphens, and underscores.");
  }
}

async function ensureFormsConfigDir() {
  await mkdir(FORMS_CONFIG_ROOT, { recursive: true });
}

function formsConfigPath(fileName: string) {
  return path.join(FORMS_CONFIG_ROOT, fileName);
}

function perSheetFileName(prefix: string, sheetId: string) {
  assertSafeSheetId(sheetId);
  return `${prefix}-${sheetId}.json`;
}

async function readJsonFile<T>(fileName: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(formsConfigPath(fileName), "utf8");
    return JSON.parse(stripBom(raw)) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(fileName: string, value: unknown) {
  await ensureFormsConfigDir();
  await writeFile(formsConfigPath(fileName), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export interface FormEntry {
  id: string;
  name: string;
  createdAt: string;
  source: "template" | "scratch" | "imported" | "sample";
}

export interface RegistryShape {
  activeSheetId: string;
  forms: FormEntry[];
}

export type FormFieldsFile = Record<string, FormFieldConfig>;

export interface WebhookState {
  lastEventId?: string;
  lastWebhookAt?: string;
  webhookId?: number;
  recentEvents: { at: string; type: string; objectId: number; sheetId?: number }[];
}

const DEFAULT_REGISTRY: RegistryShape = { activeSheetId: "", forms: [] };

const DEFAULT_WEBHOOK_STATE: WebhookState = { recentEvents: [] };

export async function readRegistry(): Promise<RegistryShape> {
  const data = await readJsonFile<RegistryShape>(REGISTRY_FILE, DEFAULT_REGISTRY);
  return {
    activeSheetId: data.activeSheetId ?? "",
    forms: Array.isArray(data.forms) ? data.forms : [],
  };
}

export async function writeRegistry(registry: RegistryShape): Promise<void> {
  await writeJsonFile(REGISTRY_FILE, registry);
}

export async function readWorkflowFile(sheetId?: string): Promise<Workflow | null> {
  if (sheetId) {
    const perSheet = await readJsonFile<Workflow | null>(
      perSheetFileName("workflow", sheetId),
      null,
    );
    if (perSheet) {
      return perSheet;
    }
  }
  return readJsonFile<Workflow | null>(WORKFLOW_FILE, null);
}

export async function writeWorkflowFile(workflow: Workflow, sheetId?: string): Promise<void> {
  const fileName = sheetId ? perSheetFileName("workflow", sheetId) : WORKFLOW_FILE;
  await writeJsonFile(fileName, workflow);
}

export async function readFormFieldsFile(): Promise<FormFieldsFile> {
  const data = await readJsonFile<FormFieldsFile>(FORM_FIELDS_FILE, {});
  return data && typeof data === "object" ? data : {};
}

export async function readFormFieldsForSheet(sheetId: string): Promise<FormFieldConfig | null> {
  assertSafeSheetId(sheetId);
  const all = await readFormFieldsFile();
  return all[sheetId] ?? null;
}

export async function writeFormFieldsForSheet(sheetId: string, fieldConfig: FormFieldConfig): Promise<void> {
  assertSafeSheetId(sheetId);
  const all = await readFormFieldsFile();
  all[sheetId] = fieldConfig;
  await writeJsonFile(FORM_FIELDS_FILE, all);
}

export async function readConditionalRulesFile(sheetId?: string): Promise<ConditionalRule[] | null> {
  if (sheetId) {
    const perSheet = await readJsonFile<ConditionalRule[] | null>(
      perSheetFileName("conditional-logic", sheetId),
      null,
    );
    if (perSheet) {
      return perSheet;
    }
  }
  return readJsonFile<ConditionalRule[] | null>(CONDITIONAL_LOGIC_FILE, null);
}

export async function writeConditionalRulesFile(rules: ConditionalRule[], sheetId?: string): Promise<void> {
  const fileName = sheetId ? perSheetFileName("conditional-logic", sheetId) : CONDITIONAL_LOGIC_FILE;
  await writeJsonFile(fileName, rules);
}

export async function readWebhookState(sheetId = "default"): Promise<WebhookState> {
  if (sheetId !== "default") {
    assertSafeSheetId(sheetId);
    const perSheet = await readJsonFile<WebhookState | null>(
      perSheetFileName("webhook-state", sheetId),
      null,
    );
    if (perSheet) {
      return { ...DEFAULT_WEBHOOK_STATE, ...perSheet, recentEvents: perSheet.recentEvents ?? [] };
    }
  }
  const data = await readJsonFile<WebhookState>(WEBHOOK_STATE_FILE, DEFAULT_WEBHOOK_STATE);
  return { ...DEFAULT_WEBHOOK_STATE, ...data, recentEvents: data.recentEvents ?? [] };
}

export async function writeWebhookState(state: WebhookState, sheetId = "default"): Promise<void> {
  const fileName = sheetId === "default" ? WEBHOOK_STATE_FILE : perSheetFileName("webhook-state", sheetId);
  await writeJsonFile(fileName, state);
}

export async function seedFileDefaultsIfMissing(
  workflow: Workflow,
  conditionalRules: ConditionalRule[],
  formFields?: FormFieldsFile,
): Promise<void> {
  await ensureFormsConfigDir();
  if (!(await readWorkflowFile())) {
    await writeWorkflowFile(workflow);
  }
  if (!(await readConditionalRulesFile())) {
    await writeConditionalRulesFile(conditionalRules);
  }
  if (formFields && Object.keys(formFields).length > 0) {
    const existing = await readFormFieldsFile();
    if (Object.keys(existing).length === 0) {
      await writeJsonFile(FORM_FIELDS_FILE, formFields);
    }
  }
}
