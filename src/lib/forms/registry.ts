/**
 * Forms registry facade over Admin Sources (unified catalog).
 * FormEntry.id remains the Smartsheet sheet id string for API compatibility.
 * Selection is stored as activeSourceId (source slug).
 */
import { saveSourceConfig } from "@/lib/config/admin-store";
import { getSourceConfigById, listSourceConfigs } from "@/lib/config/store";
import type { FormProvenance, SourceConfig } from "@/lib/config/types";
import { validateSourceConfig } from "@/lib/config/validation";
import { config } from "@/lib/forms/config";
import { ensureFormsTables, isFormsDatabaseEnabled, queryFormsDb } from "@/lib/forms/db";
import { normalizeFormSlug, slugFromFormName } from "@/lib/forms/slug";
import {
  readRegistry,
  writeRegistry,
  type FormEntry,
  type RegistryShape,
} from "@/lib/forms/store/file-store";
import { slugify } from "@/lib/utils";

export type { FormEntry };

const REGISTRY_ROW_ID = "registry";

let demoPreference: RegistryShape = { activeSheetId: "", forms: [], activeSourceId: "" };
let demoLoaded = false;
let migratePromise: Promise<void> | null = null;

function sourceIsFormsSheet(source: SourceConfig): boolean {
  if (source.sourceType !== "sheet") return false;
  return source.formsEnabled !== false;
}

function sourceToFormEntry(source: SourceConfig): FormEntry {
  const id = String(source.smartsheetId);
  const slug =
    source.formSlug?.trim() ||
    slugFromFormName(source.label, id);
  return {
    id,
    name: source.label,
    createdAt: source.formRegisteredAt || source.formPublishedAt || new Date(0).toISOString(),
    source: source.formProvenance ?? "imported",
    slug: normalizeFormSlug(slug) || slugFromFormName(source.label, id),
    public: Boolean(source.formPublic),
    publishedAt: source.formPublishedAt,
    sourceConfigId: source.id,
  };
}

function ensureFormEntryDefaults(form: FormEntry): FormEntry {
  const slug = form.slug?.trim() ? normalizeFormSlug(form.slug) : slugFromFormName(form.name, form.id);
  return {
    ...form,
    slug: slug || slugFromFormName(form.name, form.id),
    public: Boolean(form.public),
    publishedAt: form.publishedAt,
  };
}

async function readPreferenceRaw(): Promise<RegistryShape> {
  if (config.demo) {
    if (!demoLoaded) {
      demoPreference = await readRegistry();
      demoLoaded = true;
    }
    return demoPreference;
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
        activeSourceId: row.data.activeSourceId ?? "",
        activeSheetId: row.data.activeSheetId ?? "",
        forms: Array.isArray(row.data.forms) ? row.data.forms : [],
        migratedToSourcesAt: row.data.migratedToSourcesAt,
      };
    }
    return { activeSheetId: "", forms: [] };
  }
  return readRegistry();
}

async function writePreference(preference: RegistryShape): Promise<void> {
  const next: RegistryShape = {
    activeSourceId: preference.activeSourceId ?? "",
    activeSheetId: preference.activeSheetId ?? "",
    forms: preference.forms ?? [],
    migratedToSourcesAt: preference.migratedToSourcesAt,
  };
  if (config.demo) {
    demoPreference = next;
    return;
  }
  if (isFormsDatabaseEnabled()) {
    await ensureFormsTables();
    await queryFormsDb(
      `INSERT INTO form_registry (id, data) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET data = $2`,
      [REGISTRY_ROW_ID, JSON.stringify(next)],
    );
    return;
  }
  await writeRegistry(next);
}

async function uniqueSourceId(baseLabel: string, sheetId: string, existingIds: Set<string>): Promise<string> {
  const base = slugify(baseLabel) || `sheet-${sheetId.slice(-8)}`;
  if (!existingIds.has(base)) return base;
  const withSheet = slugify(`${baseLabel}-${sheetId.slice(-6)}`) || `${base}-${sheetId.slice(-6)}`;
  if (!existingIds.has(withSheet)) return withSheet;
  let n = 2;
  while (existingIds.has(`${withSheet}-${n}`)) n += 1;
  return `${withSheet}-${n}`;
}

/**
 * One-time: lift legacy FormEntry rows into SourceConfig and set activeSourceId.
 */
export async function ensureFormsSourcesMigrated(): Promise<void> {
  if (!migratePromise) {
    migratePromise = (async () => {
      const preference = await readPreferenceRaw();
      if (preference.migratedToSourcesAt) {
        return;
      }

      const sources = await listSourceConfigs();
      const bySmartsheetId = new Map(sources.map((s) => [s.smartsheetId, s]));
      const usedIds = new Set(sources.map((s) => s.id));
      const legacyForms = preference.forms ?? [];

      for (const raw of legacyForms) {
        const form = ensureFormEntryDefaults(raw);
        const sheetId = Number(form.id);
        if (!Number.isFinite(sheetId) || sheetId <= 0) continue;

        let source = bySmartsheetId.get(sheetId);
        if (!source) {
          const id = await uniqueSourceId(form.name, form.id, usedIds);
          usedIds.add(id);
          const candidate: SourceConfig = {
            id,
            label: form.name,
            sourceType: "sheet",
            smartsheetId: sheetId,
            formsEnabled: true,
            formSlug: form.slug,
            formPublic: Boolean(form.public),
            formPublishedAt: form.publishedAt,
            formProvenance: form.source,
            formRegisteredAt: form.createdAt,
            fetchOptions: {
              includeObjectValue: true,
              includeColumnOptions: true,
            },
          };
          const validated = validateSourceConfig(candidate);
          if (!validated.success || !validated.data) {
            continue;
          }
          await saveSourceConfig(validated.data);
          source = validated.data;
          bySmartsheetId.set(sheetId, source);
        } else if (source.sourceType === "sheet") {
          const updated: SourceConfig = {
            ...source,
            formsEnabled: source.formsEnabled !== false,
            formSlug: source.formSlug || form.slug,
            formPublic: source.formPublic ?? Boolean(form.public),
            formPublishedAt: source.formPublishedAt || form.publishedAt,
            formProvenance: source.formProvenance || form.source,
            formRegisteredAt: source.formRegisteredAt || form.createdAt,
          };
          const validated = validateSourceConfig(updated);
          if (validated.success && validated.data) {
            await saveSourceConfig(validated.data);
            bySmartsheetId.set(sheetId, validated.data);
          }
        }
      }

      let activeSourceId = preference.activeSourceId?.trim() || "";
      if (!activeSourceId && preference.activeSheetId) {
        const sheetNum = Number(preference.activeSheetId);
        const match = bySmartsheetId.get(sheetNum);
        if (match) activeSourceId = match.id;
      }
      if (!activeSourceId) {
        const firstSheet = [...bySmartsheetId.values()].find(sourceIsFormsSheet);
        if (firstSheet) activeSourceId = firstSheet.id;
      }

      await writePreference({
        activeSourceId,
        activeSheetId: activeSourceId
          ? String(bySmartsheetId.get(Number(preference.activeSheetId))?.smartsheetId ?? preference.activeSheetId ?? "")
          : preference.activeSheetId ?? "",
        forms: [],
        migratedToSourcesAt: new Date().toISOString(),
      });
    })().catch((err) => {
      migratePromise = null;
      throw err;
    });
  }
  await migratePromise;
}

async function listFormSources(): Promise<SourceConfig[]> {
  await ensureFormsSourcesMigrated();
  const sources = await listSourceConfigs();
  return sources.filter(sourceIsFormsSheet);
}

async function findSourceBySheetId(sheetId: string): Promise<SourceConfig | null> {
  const num = Number(sheetId);
  if (!Number.isFinite(num)) return null;
  const sources = await listFormSources();
  return sources.find((s) => s.smartsheetId === num) ?? null;
}

async function getActiveSource(): Promise<SourceConfig | null> {
  await ensureFormsSourcesMigrated();
  const preference = await readPreferenceRaw();
  if (preference.activeSourceId?.trim()) {
    const source = await getSourceConfigById(preference.activeSourceId.trim());
    if (source && sourceIsFormsSheet(source)) return source;
  }
  if (preference.activeSheetId) {
    return findSourceBySheetId(preference.activeSheetId);
  }
  return null;
}

function assertUniqueFormSlug(sources: SourceConfig[], slug: string, exceptSheetId?: string) {
  const clash = sources.find(
    (s) =>
      s.formSlug === slug &&
      String(s.smartsheetId) !== exceptSheetId &&
      sourceIsFormsSheet(s),
  );
  if (clash) {
    throw Object.assign(new Error(`Slug "${slug}" is already used by another form.`), { status: 409 });
  }
}

export async function listForms(): Promise<FormEntry[]> {
  const sources = await listFormSources();
  return sources.map(sourceToFormEntry);
}

export async function activeSheetId(): Promise<string> {
  const source = await getActiveSource();
  return source ? String(source.smartsheetId) : "";
}

export async function activeSourceId(): Promise<string> {
  const source = await getActiveSource();
  return source?.id ?? "";
}

export async function getFormById(id: string): Promise<FormEntry | null> {
  const source = await findSourceBySheetId(String(id));
  return source ? sourceToFormEntry(source) : null;
}

export async function getFormBySlug(slug: string): Promise<FormEntry | null> {
  const normalized = normalizeFormSlug(slug);
  if (!normalized) return null;
  const sources = await listFormSources();
  const source = sources.find((s) => (s.formSlug || sourceToFormEntry(s).slug) === normalized);
  return source ? sourceToFormEntry(source) : null;
}

export async function getPublishedFormBySlug(slug: string): Promise<FormEntry | null> {
  const form = await getFormBySlug(slug);
  if (!form || !form.public) return null;
  return form;
}

export async function publishForm(
  id: string,
  options?: { slug?: string },
): Promise<FormEntry> {
  const source = await findSourceBySheetId(String(id));
  if (!source) {
    throw Object.assign(new Error("Form not found."), { status: 404 });
  }
  if (source.sourceType !== "sheet") {
    throw Object.assign(new Error("Only sheet sources can be published as forms."), { status: 400 });
  }
  const sources = await listFormSources();
  const slug =
    normalizeFormSlug(options?.slug ?? source.formSlug ?? source.label) ||
    slugFromFormName(source.label, String(source.smartsheetId));
  assertUniqueFormSlug(sources, slug, String(source.smartsheetId));
  const updated: SourceConfig = {
    ...source,
    formsEnabled: true,
    formSlug: slug,
    formPublic: true,
    formPublishedAt: new Date().toISOString(),
  };
  const validated = validateSourceConfig(updated);
  if (!validated.success || !validated.data) {
    throw Object.assign(new Error(validated.errors.join(" ") || "Invalid source."), { status: 400 });
  }
  await saveSourceConfig(validated.data);
  return sourceToFormEntry(validated.data);
}

export async function unpublishForm(id: string): Promise<FormEntry> {
  const source = await findSourceBySheetId(String(id));
  if (!source) {
    throw Object.assign(new Error("Form not found."), { status: 404 });
  }
  const updated: SourceConfig = {
    ...source,
    formPublic: false,
    formPublishedAt: undefined,
  };
  const validated = validateSourceConfig(updated);
  if (!validated.success || !validated.data) {
    throw Object.assign(new Error(validated.errors.join(" ") || "Invalid source."), { status: 400 });
  }
  await saveSourceConfig(validated.data);
  return sourceToFormEntry(validated.data);
}

export async function updateFormSlug(id: string, rawSlug: string): Promise<FormEntry> {
  const source = await findSourceBySheetId(String(id));
  if (!source) {
    throw Object.assign(new Error("Form not found."), { status: 404 });
  }
  const slug = normalizeFormSlug(rawSlug);
  if (!slug) {
    throw Object.assign(new Error("Slug is required."), { status: 400 });
  }
  assertUniqueFormSlug(await listFormSources(), slug, String(source.smartsheetId));
  const updated: SourceConfig = { ...source, formSlug: slug };
  const validated = validateSourceConfig(updated);
  if (!validated.success || !validated.data) {
    throw Object.assign(new Error(validated.errors.join(" ") || "Invalid source."), { status: 400 });
  }
  await saveSourceConfig(validated.data);
  return sourceToFormEntry(validated.data);
}

/** Select active form by Smartsheet sheet id (FormEntry.id) or by source config id. */
export async function selectForm(id: string): Promise<boolean> {
  await ensureFormsSourcesMigrated();
  const trimmed = String(id).trim();
  if (!trimmed) return false;

  let source = await findSourceBySheetId(trimmed);
  if (!source) {
    const byId = await getSourceConfigById(trimmed);
    if (byId && sourceIsFormsSheet(byId)) source = byId;
  }
  if (!source) return false;

  const preference = await readPreferenceRaw();
  await writePreference({
    ...preference,
    activeSourceId: source.id,
    activeSheetId: String(source.smartsheetId),
    forms: [],
    migratedToSourcesAt: preference.migratedToSourcesAt || new Date().toISOString(),
  });
  return true;
}

/** Select active form by Admin source id (slug). */
export async function selectFormBySourceId(sourceId: string): Promise<boolean> {
  return selectForm(sourceId);
}

export async function registerForm(entry: FormEntry, makeActive = true): Promise<void> {
  await ensureFormsSourcesMigrated();
  const withDefaults = ensureFormEntryDefaults(entry);
  const sheetId = Number(withDefaults.id);
  if (!Number.isFinite(sheetId) || sheetId <= 0) {
    throw Object.assign(new Error("Invalid sheet id."), { status: 400 });
  }

  const sources = await listSourceConfigs();
  const usedIds = new Set(sources.map((s) => s.id));
  let source = sources.find((s) => s.smartsheetId === sheetId) ?? null;

  let slug = withDefaults.slug || slugFromFormName(withDefaults.name, withDefaults.id);
  const usedSlugs = new Set(
    sources
      .filter((s) => s.smartsheetId !== sheetId && s.formSlug)
      .map((s) => s.formSlug as string),
  );
  if (usedSlugs.has(slug)) {
    const suffix = normalizeFormSlug(withDefaults.id).slice(-8) || withDefaults.id.slice(-8);
    slug = normalizeFormSlug(`${slug}-${suffix}`) || `${slug}-${suffix}`;
  }

  if (!source) {
    const id = await uniqueSourceId(withDefaults.name, withDefaults.id, usedIds);
    source = {
      id,
      label: withDefaults.name,
      sourceType: "sheet",
      smartsheetId: sheetId,
      formsEnabled: true,
      formSlug: slug,
      formPublic: withDefaults.public ?? false,
      formPublishedAt: withDefaults.publishedAt,
      formProvenance: withDefaults.source as FormProvenance,
      formRegisteredAt: withDefaults.createdAt,
      fetchOptions: { includeObjectValue: true, includeColumnOptions: true },
    };
  } else {
    source = {
      ...source,
      label: withDefaults.name || source.label,
      formsEnabled: true,
      formSlug: slug,
      formPublic: withDefaults.public ?? source.formPublic ?? false,
      formPublishedAt: withDefaults.publishedAt ?? source.formPublishedAt,
      formProvenance: (withDefaults.source as FormProvenance) || source.formProvenance || "imported",
      formRegisteredAt: source.formRegisteredAt || withDefaults.createdAt,
    };
  }

  const validated = validateSourceConfig(source);
  if (!validated.success || !validated.data) {
    throw Object.assign(new Error(validated.errors.join(" ") || "Invalid source."), { status: 400 });
  }
  await saveSourceConfig(validated.data);

  if (makeActive) {
    await selectForm(String(validated.data.smartsheetId));
  }
}

export async function ensureSeed(entry: FormEntry): Promise<void> {
  const existing = await getFormById(entry.id);
  if (!existing) {
    await registerForm(entry, false);
  }
  const active = await activeSheetId();
  if (!active) {
    await selectForm(entry.id);
  }
}

export async function isRegistryEmpty(): Promise<boolean> {
  const forms = await listForms();
  return forms.length === 0;
}
