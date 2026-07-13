import { config } from "@/lib/forms/config";
import { ensureFormsTables, isFormsDatabaseEnabled, queryFormsDb } from "@/lib/forms/db";
import {
  readRegistry,
  writeRegistry,
  type FormEntry,
  type RegistryShape,
} from "@/lib/forms/store/file-store";

export type { FormEntry };

const REGISTRY_ROW_ID = "registry";

let demoRegistry: RegistryShape = { activeSheetId: "", forms: [] };
let demoLoaded = false;

async function readRegistryShape(): Promise<RegistryShape> {
  if (config.demo) {
    if (!demoLoaded) {
      demoRegistry = await readRegistry();
      demoLoaded = true;
    }
    return demoRegistry;
  }
  if (isFormsDatabaseEnabled()) {
    await ensureFormsTables();
    const { rows } = await queryFormsDb<{ data: RegistryShape }>(
      "SELECT data FROM form_registry WHERE id = $1",
      [REGISTRY_ROW_ID],
    );
    const row = rows[0];
    if (row?.data) {
      return {
        activeSheetId: row.data.activeSheetId ?? "",
        forms: Array.isArray(row.data.forms) ? row.data.forms : [],
      };
    }
    return { activeSheetId: "", forms: [] };
  }

  return readRegistry();
}

async function writeRegistryShape(registry: RegistryShape): Promise<void> {
  if (config.demo) {
    demoRegistry = registry;
    return;
  }

  if (isFormsDatabaseEnabled()) {
    await ensureFormsTables();
    await queryFormsDb(
      `INSERT INTO form_registry (id, data) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET data = $2`,
      [REGISTRY_ROW_ID, JSON.stringify(registry)],
    );
    return;
  }

  await writeRegistry(registry);
}

export async function listForms(): Promise<FormEntry[]> {
  const registry = await readRegistryShape();
  return registry.forms;
}

export async function activeSheetId(): Promise<string> {
  const registry = await readRegistryShape();
  return registry.activeSheetId;
}

export async function selectForm(id: string): Promise<boolean> {
  const registry = await readRegistryShape();
  if (!registry.forms.some((form) => form.id === String(id))) {
    return false;
  }
  registry.activeSheetId = String(id);
  await writeRegistryShape(registry);
  return true;
}

export async function registerForm(entry: FormEntry, makeActive = true): Promise<void> {
  const registry = await readRegistryShape();
  const existing = registry.forms.find((form) => form.id === entry.id);
  if (existing) {
    Object.assign(existing, entry);
  } else {
    registry.forms.unshift(entry);
  }
  if (makeActive || !registry.activeSheetId) {
    registry.activeSheetId = entry.id;
  }
  await writeRegistryShape(registry);
}

export async function ensureSeed(entry: FormEntry): Promise<void> {
  const registry = await readRegistryShape();
  if (!registry.forms.some((form) => form.id === entry.id)) {
    registry.forms.push(entry);
  }
  if (!registry.activeSheetId) {
    registry.activeSheetId = entry.id;
  }
  await writeRegistryShape(registry);
}

export async function isRegistryEmpty(): Promise<boolean> {
  const registry = await readRegistryShape();
  return registry.forms.length === 0;
}
