import { mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PublicPageSummary, SourceConfig, ViewConfig } from "@/lib/config/types";
import { normalizePublishedSlug } from "@/lib/slug-normalize";
import { humanizeSlug } from "@/lib/utils";
import { validateSourceConfig, validateViewConfig } from "@/lib/config/validation";

const CONFIG_ROOT = path.join(process.cwd(), "config");
const MAX_CONFIG_FILE_STEM_LEN = 120;
const SAFE_CONFIG_FILE_STEM = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

function assertSafeConfigFileStem(id: string, label: string) {
  if (!id) {
    throw new Error(`${label} is required.`);
  }
  if (id.length > MAX_CONFIG_FILE_STEM_LEN) {
    throw new Error(`${label} is too long (max ${MAX_CONFIG_FILE_STEM_LEN} characters).`);
  }
  if (!SAFE_CONFIG_FILE_STEM.test(id)) {
    throw new Error(`${label} may only contain letters, numbers, hyphens, and underscores.`);
  }
}

function stripBom(value: string) {
  return value.replace(/^\uFEFF/, "");
}

function configDir(folderName: "sources" | "views") {
  return path.join(CONFIG_ROOT, folderName);
}

function configFilePath(folderName: "sources" | "views", id: string) {
  assertSafeConfigFileStem(id, "Config id");
  return path.join(configDir(folderName), `${id}.json`);
}

async function ensureConfigDir(folderName: "sources" | "views") {
  await mkdir(configDir(folderName), { recursive: true });
}

async function readConfigDir<T>(folderName: "sources" | "views", parser: (value: unknown, fileName: string) => T): Promise<T[]> {
  const folderPath = configDir(folderName);
  const entries = await readdir(folderPath, { withFileTypes: true }).catch(() => []);
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();

  const results: Array<T | null> = await Promise.all(
    files.map(async (fileName): Promise<T | null> => {
      const filePath = path.join(folderPath, fileName);
      try {
        const raw = await readFile(filePath, "utf8");
        const trimmed = stripBom(raw).trim();
        if (!trimmed) {
          console.warn(`[config] Skipping empty ${folderName} file: ${fileName}`);
          return null;
        }
        return parser(JSON.parse(trimmed) as unknown, fileName);
      } catch (error) {
        console.warn(
          `[config] Skipping invalid ${folderName} file ${fileName}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return null;
      }
    }),
  );
  return results.filter((item): item is T => item != null);
}

function parseSourceConfig(value: unknown, fileName: string): SourceConfig {
  const result = validateSourceConfig(value);
  if (!result.success || !result.data) {
    throw new Error(`Invalid source config in ${fileName}: ${result.errors.join(" ")}`);
  }
  return result.data;
}

function parseViewConfig(value: unknown, fileName: string, knownSourceIds: string[], sources: SourceConfig[]): ViewConfig {
  const result = validateViewConfig(value, { knownSourceIds, sources });
  if (!result.success || !result.data) {
    throw new Error(`Invalid view config in ${fileName}: ${result.errors.join(" ")}`);
  }
  return result.data;
}

async function writePrettyJson(folderName: "sources" | "views", id: string, value: unknown) {
  await ensureConfigDir(folderName);
  const target = configFilePath(folderName, id);
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(temp, payload, "utf8");
  try {
    await rename(temp, target);
  } catch {
    await unlink(target).catch(() => undefined);
    await rename(temp, target);
  }
}

async function deleteConfigFile(folderName: "sources" | "views", id: string) {
  await unlink(configFilePath(folderName, id)).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") {
      return;
    }
    throw error;
  });
}

export async function listSourceConfigs(): Promise<SourceConfig[]> {
  return readConfigDir("sources", parseSourceConfig);
}

export async function listViewConfigs(): Promise<ViewConfig[]> {
  const sources = await listSourceConfigs();
  const knownSourceIds = sources.map((source) => source.id);
  return readConfigDir("views", (value, fileName) => parseViewConfig(value, fileName, knownSourceIds, sources));
}

export async function getSourceConfigById(sourceId: string) {
  const sources = await listSourceConfigs();
  return sources.find((source) => source.id === sourceId) ?? null;
}

export async function getViewConfigById(viewId: string) {
  const views = await listViewConfigs();
  return views.find((view) => view.id === viewId) ?? null;
}

export async function getPublicViewsBySlug(slug: string, options?: { includePrivate?: boolean }) {
  const views = await listViewConfigs();
  const slugNorm = normalizePublishedSlug(slug);
  return views
    .filter(
      (view) => (options?.includePrivate || view.public) && normalizePublishedSlug(view.slug) === slugNorm,
    )
    .sort((left, right) => (left.tabOrder ?? 999) - (right.tabOrder ?? 999) || left.label.localeCompare(right.label));
}

export async function listPublicPageSummaries(): Promise<PublicPageSummary[]> {
  const [sources, views] = await Promise.all([listSourceConfigs(), listViewConfigs()]);
  const sourcesById = new Map(sources.map((source) => [source.id, source]));
  const groups = new Map<string, ViewConfig[]>();

  for (const view of views.filter((record) => record.public)) {
    const key = normalizePublishedSlug(view.slug);
    const existing = groups.get(key) ?? [];
    existing.push(view);
    groups.set(key, existing);
  }

  return [...groups.entries()]
    .sort(([leftSlug], [rightSlug]) => leftSlug.localeCompare(rightSlug))
    .flatMap(([slug, groupedViews]) => {
      const sortedViews = [...groupedViews].sort(
        (left, right) => (left.tabOrder ?? 999) - (right.tabOrder ?? 999) || left.label.localeCompare(right.label)
      );
      const distinctSourceIds = [...new Set(sortedViews.map((view) => view.sourceId).filter(Boolean))];
      if (distinctSourceIds.length > 1) {
        console.warn(
          `[smartsheets_view] Slug "${slug}" is published for multiple sources (${distinctSourceIds.join(", ")}). Skipping it from the public summary list.`
        );
        return [];
      }
      const sourceId = sortedViews[0]?.sourceId ?? "";
      const sourceLabel = sourcesById.get(sourceId)?.label ?? sourceId;

      return [{
        slug,
        title: humanizeSlug(slug),
        sourceId,
        sourceLabel,
        views: sortedViews.map((view) => ({
          id: view.id,
          label: view.label,
          description: view.description,
        })),
      }];
    });
}

export async function saveSourceConfig(config: SourceConfig) {
  const result = validateSourceConfig(config);
  if (!result.success || !result.data) {
    throw new Error(result.errors.join(" "));
  }

  await writePrettyJson("sources", result.data.id, result.data);
}

export async function saveViewConfig(config: ViewConfig) {
  const sources = await listSourceConfigs();
  const result = validateViewConfig(config, { knownSourceIds: sources.map((source) => source.id), sources });
  if (!result.success || !result.data) {
    throw new Error(result.errors.join(" "));
  }

  await writePrettyJson("views", result.data.id, result.data);
}

export async function deleteSourceConfig(sourceId: string) {
  await deleteConfigFile("sources", sourceId);
}

export async function deleteViewConfig(viewId: string) {
  await deleteConfigFile("views", viewId);
}

export async function updateViewPublication(viewId: string, isPublic: boolean) {
  const view = await getViewConfigById(viewId);
  if (!view) {
    throw new Error(`View \"${viewId}\" was not found.`);
  }

  const updated = { ...view, public: isPublic };
  await saveViewConfig(updated);
  return updated;
}
