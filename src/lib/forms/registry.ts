import { config } from "@/lib/forms/config";
import { ensureFormsTables, isFormsDatabaseEnabled, queryFormsDb } from "@/lib/forms/db";
import { normalizeFormSlug, slugFromFormName } from "@/lib/forms/slug";
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

function ensureFormEntryDefaults(form: FormEntry): FormEntry {
  const slug = form.slug?.trim() ? normalizeFormSlug(form.slug) : slugFromFormName(form.name, form.id);
  return {
    ...form,
    slug: slug || slugFromFormName(form.name, form.id),
    public: Boolean(form.public),
    publishedAt: form.publishedAt,
  };
}

function normalizeRegistry(registry: RegistryShape): RegistryShape {
  const used = new Set<string>();
  const forms = registry.forms.map((raw) => {
    const form = ensureFormEntryDefaults(raw);
    let slug = form.slug || slugFromFormName(form.name, form.id);
    if (used.has(slug)) {
      const suffix = normalizeFormSlug(form.id).slice(-8) || form.id.slice(-8);
      slug = normalizeFormSlug(`${slug}-${suffix}`) || `${slug}-${suffix}`;
    }
    used.add(slug);
    return { ...form, slug };
  });
  return {
    activeSheetId: registry.activeSheetId ?? "",
    forms,
  };
}

async function readRegistryShape(): Promise<RegistryShape> {
  if (config.demo) {
    if (!demoLoaded) {
      demoRegistry = normalizeRegistry(await readRegistry());
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
      return normalizeRegistry({
        activeSheetId: row.data.activeSheetId ?? "",
        forms: Array.isArray(row.data.forms) ? row.data.forms : [],
      });
    }
    return { activeSheetId: "", forms: [] };
  }

  return normalizeRegistry(await readRegistry());
}

async function writeRegistryShape(registry: RegistryShape): Promise<void> {
  const normalized = normalizeRegistry(registry);
  if (config.demo) {
    demoRegistry = normalized;
    return;
  }

  if (isFormsDatabaseEnabled()) {
    await ensureFormsTables();
    await queryFormsDb(
      `INSERT INTO form_registry (id, data) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET data = $2`,
      [REGISTRY_ROW_ID, JSON.stringify(normalized)],
    );
    return;
  }

  await writeRegistry(normalized);
}

export async function listForms(): Promise<FormEntry[]> {
  const registry = await readRegistryShape();
  return registry.forms;
}

export async function activeSheetId(): Promise<string> {
  const registry = await readRegistryShape();
  return registry.activeSheetId;
}

export async function getFormById(id: string): Promise<FormEntry | null> {
  const registry = await readRegistryShape();
  return registry.forms.find((form) => form.id === String(id)) ?? null;
}

export async function getFormBySlug(slug: string): Promise<FormEntry | null> {
  const normalized = normalizeFormSlug(slug);
  if (!normalized) return null;
  const registry = await readRegistryShape();
  return registry.forms.find((form) => form.slug === normalized) ?? null;
}

/** Published form only — for public schema/submit. */
export async function getPublishedFormBySlug(slug: string): Promise<FormEntry | null> {
  const form = await getFormBySlug(slug);
  if (!form || !form.public) return null;
  return form;
}

function assertUniqueSlug(registry: RegistryShape, slug: string, exceptId?: string) {
  const clash = registry.forms.find((form) => form.slug === slug && form.id !== exceptId);
  if (clash) {
    throw Object.assign(new Error(`Slug "${slug}" is already used by another form.`), { status: 409 });
  }
}

export async function publishForm(
  id: string,
  options?: { slug?: string },
): Promise<FormEntry> {
  const registry = await readRegistryShape();
  const form = registry.forms.find((f) => f.id === String(id));
  if (!form) {
    throw Object.assign(new Error("Form not found."), { status: 404 });
  }
  const slug = normalizeFormSlug(options?.slug ?? form.slug ?? form.name) || slugFromFormName(form.name, form.id);
  assertUniqueSlug(registry, slug, form.id);
  form.slug = slug;
  form.public = true;
  form.publishedAt = new Date().toISOString();
  await writeRegistryShape(registry);
  return ensureFormEntryDefaults(form);
}

export async function unpublishForm(id: string): Promise<FormEntry> {
  const registry = await readRegistryShape();
  const form = registry.forms.find((f) => f.id === String(id));
  if (!form) {
    throw Object.assign(new Error("Form not found."), { status: 404 });
  }
  form.public = false;
  form.publishedAt = undefined;
  await writeRegistryShape(registry);
  return ensureFormEntryDefaults(form);
}

export async function updateFormSlug(id: string, rawSlug: string): Promise<FormEntry> {
  const registry = await readRegistryShape();
  const form = registry.forms.find((f) => f.id === String(id));
  if (!form) {
    throw Object.assign(new Error("Form not found."), { status: 404 });
  }
  const slug = normalizeFormSlug(rawSlug);
  if (!slug) {
    throw Object.assign(new Error("Slug is required."), { status: 400 });
  }
  assertUniqueSlug(registry, slug, form.id);
  form.slug = slug;
  await writeRegistryShape(registry);
  return ensureFormEntryDefaults(form);
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
  const withDefaults = ensureFormEntryDefaults(entry);
  let slug = withDefaults.slug || slugFromFormName(withDefaults.name, withDefaults.id);
  const used = new Set(registry.forms.filter((f) => f.id !== withDefaults.id).map((f) => f.slug).filter(Boolean) as string[]);
  if (used.has(slug)) {
    const suffix = normalizeFormSlug(withDefaults.id).slice(-8) || withDefaults.id.slice(-8);
    slug = normalizeFormSlug(`${slug}-${suffix}`) || `${slug}-${suffix}`;
  }
  const next: FormEntry = { ...withDefaults, slug, public: withDefaults.public ?? false };

  const existing = registry.forms.find((form) => form.id === next.id);
  if (existing) {
    Object.assign(existing, next);
  } else {
    registry.forms.unshift(next);
  }
  if (makeActive || !registry.activeSheetId) {
    registry.activeSheetId = next.id;
  }
  await writeRegistryShape(registry);
}

export async function ensureSeed(entry: FormEntry): Promise<void> {
  const registry = await readRegistryShape();
  if (!registry.forms.some((form) => form.id === entry.id)) {
    registry.forms.push(ensureFormEntryDefaults(entry));
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
