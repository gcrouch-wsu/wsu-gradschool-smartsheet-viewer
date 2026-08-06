"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PdfCustomItem, PdfFieldDisplay, PdfMappingConfig, PdfTheme } from "@/lib/forms/pdf-mapping-types";
import {
  DEFAULT_PDF_DRAFT_BANNER,
  DEFAULT_PDF_OUTPUT_FILENAME,
  defaultPdfMappingConfig,
} from "@/lib/forms/pdf-mapping-types";
import { HeaderCustomTextEditor } from "@/components/ui/HeaderCustomTextEditor";
import {
  IconChevronDown,
  IconChevronUp,
  IconExternalLink,
  IconEye,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
} from "@/components/forms/icons";

const secondaryBtn =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-1.5 text-sm font-medium text-[color:var(--wsu-ink)] hover:bg-[color:var(--wsu-stone)] disabled:opacity-50";
const primaryBtn =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-wsu-crimson px-3 py-1.5 text-sm font-medium text-white hover:bg-wsu-crimson/90 disabled:opacity-50";
const inputClass =
  "mt-1 w-full rounded-lg border border-[color:var(--wsu-border)] px-3 py-2 text-sm text-[color:var(--wsu-ink)]";
const iconBtn =
  "inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--wsu-border)] bg-white text-[color:var(--wsu-ink)] hover:bg-[color:var(--wsu-stone)] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-white";

export type PdfFieldOption = { columnTitle: string; label?: string };
export type PdfLayoutSeed = {
  columnTitle: string;
  label?: string;
  itemKind?: string;
  text?: string;
};

type Props = {
  sheetId: string;
  fieldOptions: PdfFieldOption[];
  layoutSeed?: PdfLayoutSeed[];
  formTitle?: string;
  formDescription?: string;
};

async function parseJson(r: Response): Promise<Record<string, unknown>> {
  const text = await r.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(r.ok ? "Invalid response." : text.slice(0, 160) || `Request failed (${r.status}).`);
  }
}

function newId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function plainText(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function seedItems(
  options: PdfFieldOption[],
  saved: PdfCustomItem[] | null | undefined,
  layoutSeed?: PdfLayoutSeed[],
): PdfCustomItem[] {
  if (saved && saved.length > 0) {
    const known = new Set(options.map((o) => o.columnTitle));
    const used = new Set<string>();
    const items: PdfCustomItem[] = [];
    for (const item of saved) {
      if (item.kind === "field") {
        if (!known.has(item.columnTitle) || used.has(item.columnTitle)) continue;
        used.add(item.columnTitle);
        const fallback = options.find((o) => o.columnTitle === item.columnTitle);
        items.push({ ...item, label: item.label || fallback?.label });
      } else {
        items.push(item);
      }
    }
    for (const option of options) {
      if (used.has(option.columnTitle)) continue;
      items.push({
        id: `field:${option.columnTitle}`,
        kind: "field",
        columnTitle: option.columnTitle,
        label: option.label,
        included: true,
      });
    }
    return items;
  }
  if (layoutSeed?.length) {
    return layoutSeed.map((row, index) => {
      if (row.itemKind === "heading") {
        return { id: `heading:${row.columnTitle}:${index}`, kind: "heading" as const, text: row.text || row.label || "Heading" };
      }
      if (row.itemKind === "description") {
        return { id: `description:${row.columnTitle}:${index}`, kind: "description" as const, text: row.text || row.label || "" };
      }
      if (row.itemKind === "divider") {
        return { id: `divider:${row.columnTitle}:${index}`, kind: "divider" as const };
      }
      return {
        id: `field:${row.columnTitle}`,
        kind: "field" as const,
        columnTitle: row.columnTitle,
        label: row.label,
        included: true,
      };
    });
  }
  return options.map((option) => ({
    id: `field:${option.columnTitle}`,
    kind: "field" as const,
    columnTitle: option.columnTitle,
    label: option.label,
    included: true,
  }));
}

function emptyConfig(formTitle?: string): PdfMappingConfig {
  const base = defaultPdfMappingConfig();
  const plain = plainText(formTitle ?? "") || "Final PDF";
  return {
    ...base,
    outputFileName: plain.toLowerCase().endsWith(".pdf") ? plain : `${plain}.pdf`,
  };
}

function themePatch(theme: PdfTheme, current: PdfMappingConfig): Partial<PdfMappingConfig> {
  if (theme === "official") {
    return {
      theme,
      layout: "twoColumn",
      fieldStyle: "inline",
      showCrimsonBar: false,
      showDraftWatermark: true,
      bannerText: current.bannerText || DEFAULT_PDF_DRAFT_BANNER,
      footerText: current.footerText || DEFAULT_PDF_DRAFT_BANNER,
    };
  }
  if (theme === "wsu") {
    return { theme, fieldStyle: "boxed", showCrimsonBar: true, showDraftWatermark: false };
  }
  return { theme, layout: "stacked", fieldStyle: "boxed", showCrimsonBar: false, showDraftWatermark: false };
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/40 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            value === option.value ? "bg-white text-[color:var(--wsu-ink)] shadow-sm" : "text-[color:var(--wsu-muted)] hover:text-[color:var(--wsu-ink)]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ThemeCard({
  selected,
  title,
  hint,
  onSelect,
  preview,
}: {
  selected: boolean;
  title: string;
  hint: string;
  onSelect: () => void;
  preview: "official" | "wsu" | "simple";
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-xl border p-3 text-left transition-all ${
        selected
          ? "border-wsu-crimson bg-wsu-crimson/5 ring-2 ring-wsu-crimson/20"
          : "border-[color:var(--wsu-border)] bg-white hover:border-wsu-crimson/40"
      }`}
    >
      <div className="mb-2 overflow-hidden rounded-md border border-[color:var(--wsu-border)] bg-white p-2">
        {preview === "official" ? (
          <div className="space-y-1">
            <div className="flex justify-between">
              <div className="h-2 w-16 rounded bg-neutral-800" />
              <div className="h-3 w-5 rounded-sm bg-neutral-300" />
            </div>
            <div className="grid grid-cols-2 gap-1 pt-1">
              <div className="h-1.5 rounded bg-neutral-300" />
              <div className="h-1.5 rounded bg-neutral-300" />
              <div className="h-1.5 rounded bg-neutral-200" />
              <div className="h-1.5 rounded bg-neutral-200" />
            </div>
          </div>
        ) : preview === "wsu" ? (
          <div className="space-y-1">
            <div className="h-1 rounded bg-wsu-crimson" />
            <div className="h-2 w-14 rounded bg-neutral-800" />
            <div className="h-4 rounded border border-neutral-200 bg-neutral-50" />
            <div className="h-4 rounded border border-neutral-200 bg-neutral-50" />
          </div>
        ) : (
          <div className="space-y-1">
            <div className="h-2 w-14 rounded bg-neutral-700" />
            <div className="h-1.5 w-full rounded bg-neutral-200" />
            <div className="h-1.5 w-4/5 rounded bg-neutral-200" />
          </div>
        )}
      </div>
      <p className="text-sm font-medium text-[color:var(--wsu-ink)]">{title}</p>
      <p className="mt-0.5 text-[11px] text-[color:var(--wsu-muted)]">{hint}</p>
    </button>
  );
}

function KindBadge({ kind }: { kind: PdfCustomItem["kind"] }) {
  const label = kind === "field" ? "Field" : kind === "heading" ? "Heading" : kind === "description" ? "Text" : "Line";
  const tone =
    kind === "field"
      ? "bg-sky-50 text-sky-800"
      : kind === "heading"
        ? "bg-violet-50 text-violet-800"
        : kind === "description"
          ? "bg-amber-50 text-amber-800"
          : "bg-[color:var(--wsu-stone)] text-[color:var(--wsu-muted)]";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}>{label}</span>;
}

export function PdfMappingEditor({ sheetId, fieldOptions, layoutSeed, formTitle, formDescription }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [config, setConfig] = useState<PdfMappingConfig>(() => emptyConfig(formTitle));
  const [items, setItems] = useState<PdfCustomItem[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [mobilePane, setMobilePane] = useState<"edit" | "preview">("edit");
  const previewSeq = useRef(0);

  const fieldCount = items.filter((item) => item.kind === "field").length;
  const includedCount = items.filter((item) => item.kind === "field" && item.included).length;

  const patch = (partial: Partial<PdfMappingConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
    setDirty(true);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const r = await fetch(`/api/forms/builder/pdf-mapping?sheetId=${encodeURIComponent(sheetId)}`);
      const data = await parseJson(r);
      if (!r.ok) throw new Error(String(data.error || `Failed to load (${r.status}).`));
      const raw = (data.config as PdfMappingConfig | null) ?? emptyConfig(formTitle);
      const next: PdfMappingConfig = {
        ...emptyConfig(formTitle),
        ...raw,
        outputFileName: raw.outputFileName || DEFAULT_PDF_OUTPUT_FILENAME,
        footerText: raw.footerText || emptyConfig(formTitle).footerText,
      };
      setConfig(next);
      setItems(seedItems(fieldOptions, next.items, layoutSeed));
      setShowDescription(Boolean(plainText(next.description || "")));
      setDirty(false);
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Failed to load PDF settings." });
      setItems(seedItems(fieldOptions, null, layoutSeed));
    } finally {
      setLoading(false);
    }
  }, [fieldOptions, formTitle, layoutSeed, sheetId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const draftConfig = useCallback((): PdfMappingConfig => ({
    ...config,
    items,
    fieldLabels: Object.fromEntries(
      items
        .filter((item): item is Extract<PdfCustomItem, { kind: "field" }> => item.kind === "field")
        .map((item) => [item.columnTitle, item.label?.trim() || ""] as const)
        .filter(([, label]) => label),
    ),
    includeColumns: items
      .filter((item): item is Extract<PdfCustomItem, { kind: "field" }> => item.kind === "field" && item.included)
      .map((item) => item.columnTitle),
  }), [config, items]);

  const refreshPreview = useCallback(async (openTab = false) => {
    const seq = ++previewSeq.current;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const r = await fetch("/api/forms/builder/pdf-mapping/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetId, config: draftConfig() }),
      });
      const contentType = r.headers.get("content-type") ?? "";
      if (!r.ok || !contentType.includes("pdf")) {
        const text = await r.text();
        let errMsg = `Preview failed (${r.status}).`;
        try {
          const data = JSON.parse(text) as { error?: string };
          if (data.error) errMsg = data.error;
        } catch {
          if (text.trim()) errMsg = text.slice(0, 160);
        }
        throw new Error(errMsg);
      }
      const blob = await r.blob();
      if (seq !== previewSeq.current) return;
      const url = URL.createObjectURL(blob);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      if (openTab) window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      if (seq !== previewSeq.current) return;
      setPreviewError(err instanceof Error ? err.message : "Preview failed.");
    } finally {
      if (seq === previewSeq.current) setPreviewing(false);
    }
  }, [draftConfig, sheetId]);

  useEffect(() => {
    if (loading) return;
    const timer = window.setTimeout(() => {
      void refreshPreview(false);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [loading, refreshPreview]);

  const save = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    try {
      const payload = draftConfig();
      const r = await fetch("/api/forms/builder/pdf-mapping", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetId, ...payload }),
      });
      const data = await parseJson(r);
      if (!r.ok) throw new Error(String(data.error || `Save failed (${r.status}).`));
      const saved = (data.config as PdfMappingConfig) ?? payload;
      setConfig({ ...emptyConfig(formTitle), ...saved });
      setItems(seedItems(fieldOptions, saved.items ?? payload.items, layoutSeed));
      setDirty(false);
      setMessage({ ok: true, text: "Saved. This PDF will attach on the next form submit." });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Save failed." });
    } finally {
      setSaving(false);
    }
  }, [draftConfig, fieldOptions, formTitle, layoutSeed, sheetId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (dirty && !saving) void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, save, saving]);

  const moveItem = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= items.length) return;
    setItems((prev) => {
      const copy = [...prev];
      const [row] = copy.splice(index, 1);
      if (!row) return prev;
      copy.splice(next, 0, row);
      return copy;
    });
    setDirty(true);
  };

  const updateItem = (id: string, updater: (item: PdfCustomItem) => PdfCustomItem) => {
    setItems((prev) => prev.map((row) => (row.id === id ? updater(row) : row)));
    setDirty(true);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((row) => row.id !== id));
    if (expandedId === id) setExpandedId(null);
    setDirty(true);
  };

  const insertItem = (kind: "heading" | "description" | "divider") => {
    const item: PdfCustomItem =
      kind === "heading"
        ? { id: newId("heading"), kind, text: "Section heading" }
        : kind === "description"
          ? { id: newId("description"), kind, text: "Supporting text" }
          : { id: newId("divider"), kind };
    setItems((prev) => {
      if (!expandedId) return [...prev, item];
      const index = prev.findIndex((row) => row.id === expandedId);
      if (index < 0) return [...prev, item];
      const copy = [...prev];
      copy.splice(index + 1, 0, item);
      return copy;
    });
    if (kind !== "divider") setExpandedId(item.id);
    setDirty(true);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        if (!q) return true;
        if (item.kind === "field") {
          return item.columnTitle.toLowerCase().includes(q) || (item.label ?? "").toLowerCase().includes(q);
        }
        if (item.kind === "heading" || item.kind === "description") {
          return plainText(item.text).toLowerCase().includes(q) || item.kind.includes(q);
        }
        return q.includes("div") || q.includes("line");
      });
  }, [items, query]);

  if (loading) {
    return (
      <div className="flex h-full min-h-[20rem] items-center justify-center rounded-xl border border-[color:var(--wsu-border)] bg-white text-sm text-[color:var(--wsu-muted)]">
        Loading PDF designer…
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--wsu-border)] bg-white px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-semibold text-[color:var(--wsu-ink)]">Submission PDF</h2>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-[color:var(--wsu-ink)]">
              <span className="relative inline-flex h-5 w-9 items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={config.enabled}
                  onChange={(e) => patch({ enabled: e.target.checked })}
                />
                <span className="absolute inset-0 rounded-full bg-neutral-300 transition peer-checked:bg-wsu-crimson" />
                <span className="absolute left-0.5 size-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
              </span>
              Attach to submissions
            </label>
          </div>
          <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">
            {config.enabled
              ? "A PDF is created automatically when someone submits this form."
              : "Turn this on when you want a PDF attached to each submission."}
          </p>
        </div>
        <label className="block min-w-[12rem] text-xs font-medium text-[color:var(--wsu-muted)]">
          File name
          <input
            type="text"
            value={config.outputFileName}
            onChange={(e) => patch({ outputFileName: e.target.value })}
            className={`${inputClass} mt-1 max-w-xs`}
          />
        </label>
      </div>

      {message ? (
        <p className={`mb-3 shrink-0 rounded-lg px-3 py-2 text-xs ${message.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {message.text}
        </p>
      ) : null}

      <div className="mb-3 flex shrink-0 rounded-lg border border-[color:var(--wsu-border)] bg-white p-0.5 lg:hidden">
        <button
          type="button"
          onClick={() => setMobilePane("edit")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium ${mobilePane === "edit" ? "bg-wsu-crimson text-white" : "text-[color:var(--wsu-ink)]"}`}
        >
          <IconPencil className="h-3.5 w-3.5" />
          Customize
        </button>
        <button
          type="button"
          onClick={() => setMobilePane("preview")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium ${mobilePane === "preview" ? "bg-wsu-crimson text-white" : "text-[color:var(--wsu-ink)]"}`}
        >
          <IconEye className="h-3.5 w-3.5" />
          Preview
        </button>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.95fr)]">
        <div className={`min-h-0 space-y-4 overflow-y-auto pr-1 ${mobilePane === "edit" ? "" : "hidden lg:block"}`}>
          <section className="rounded-xl border border-[color:var(--wsu-border)] bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--wsu-muted)]">Step 1</p>
            <h3 className="mt-0.5 text-sm font-medium text-[color:var(--wsu-ink)]">Choose a look</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <ThemeCard
                selected={(config.theme ?? "official") === "official"}
                title="Official"
                hint="Smartsheet-style form"
                preview="official"
                onSelect={() => patch(themePatch("official", config))}
              />
              <ThemeCard
                selected={config.theme === "wsu"}
                title="WSU boxed"
                hint="Crimson bar + boxes"
                preview="wsu"
                onSelect={() => patch(themePatch("wsu", config))}
              />
              <ThemeCard
                selected={config.theme === "simple"}
                title="Simple"
                hint="Clean and minimal"
                preview="simple"
                onSelect={() => patch(themePatch("simple", config))}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div>
                <p className="mb-1 text-[11px] font-medium text-[color:var(--wsu-muted)]">Columns</p>
                <Segmented
                  value={config.layout ?? "twoColumn"}
                  options={[
                    { value: "stacked", label: "One" },
                    { value: "twoColumn", label: "Two" },
                  ]}
                  onChange={(layout) => patch({ layout })}
                />
              </div>
              <div>
                <p className="mb-1 text-[11px] font-medium text-[color:var(--wsu-muted)]">Field style</p>
                <Segmented
                  value={(config.fieldStyle ?? "inline") as PdfFieldDisplay}
                  options={[
                    { value: "inline", label: "Inline" },
                    { value: "boxed", label: "Boxed" },
                    { value: "underline", label: "Underline" },
                  ]}
                  onChange={(fieldStyle) => patch({ fieldStyle })}
                />
              </div>
              <div>
                <p className="mb-1 text-[11px] font-medium text-[color:var(--wsu-muted)]">Spacing</p>
                <Segmented
                  value={config.density ?? "comfortable"}
                  options={[
                    { value: "comfortable", label: "Roomy" },
                    { value: "compact", label: "Tight" },
                  ]}
                  onChange={(density) => patch({ density })}
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[color:var(--wsu-border)] bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--wsu-muted)]">Step 2</p>
            <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-[color:var(--wsu-ink)]">Title & intro</h3>
              <div className="flex gap-2">
                {formTitle ? (
                  <button type="button" className="text-[11px] font-medium text-wsu-crimson hover:underline" onClick={() => patch({ title: formTitle })}>
                    Use form title
                  </button>
                ) : null}
                {formDescription ? (
                  <button
                    type="button"
                    className="text-[11px] font-medium text-wsu-crimson hover:underline"
                    onClick={() => {
                      patch({ description: formDescription });
                      setShowDescription(true);
                    }}
                  >
                    Use form intro
                  </button>
                ) : null}
              </div>
            </div>
            <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">Leave blank to keep the form’s title and description.</p>
            <div className="mt-3">
              <label className="text-xs font-medium text-[color:var(--wsu-ink)]">Title</label>
              <div className="mt-1">
                <HeaderCustomTextEditor
                  value={config.title ?? ""}
                  placeholder={plainText(formTitle ?? "") || "Form title"}
                  compact
                  onChange={(html) => patch({ title: html })}
                />
              </div>
            </div>
            {showDescription || plainText(config.description ?? "") ? (
              <div className="mt-3">
                <label className="text-xs font-medium text-[color:var(--wsu-ink)]">Intro text</label>
                <div className="mt-1">
                  <HeaderCustomTextEditor
                    value={config.description ?? ""}
                    placeholder={plainText(formDescription ?? "") || "Optional intro"}
                    onChange={(html) => patch({ description: html })}
                  />
                </div>
              </div>
            ) : (
              <button type="button" className="mt-3 text-xs font-medium text-wsu-crimson hover:underline" onClick={() => setShowDescription(true)}>
                + Add intro text
              </button>
            )}
            <button type="button" className="mt-3 text-xs font-medium text-[color:var(--wsu-muted)] hover:text-[color:var(--wsu-ink)]" onClick={() => setShowAdvanced((v) => !v)}>
              {showAdvanced ? "Hide logo, banner & footer" : "Logo, banner & footer"}
            </button>
            {showAdvanced ? (
              <div className="mt-3 space-y-3 rounded-lg border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/30 p-3">
                <label className="block text-xs font-medium text-[color:var(--wsu-ink)]">
                  Banner
                  <input type="text" value={config.bannerText ?? ""} onChange={(e) => patch({ bannerText: e.target.value })} className={inputClass} />
                </label>
                <label className="block text-xs font-medium text-[color:var(--wsu-ink)]">
                  Footer
                  <input type="text" value={config.footerText ?? ""} onChange={(e) => patch({ footerText: e.target.value })} className={inputClass} />
                </label>
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-[color:var(--wsu-ink)]">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={config.showLogo !== false} onChange={(e) => patch({ showLogo: e.target.checked })} className="size-4" />
                    Logo
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={Boolean(config.showCrimsonBar)} onChange={(e) => patch({ showCrimsonBar: e.target.checked })} className="size-4" />
                    Crimson bar
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={config.showFooter !== false} onChange={(e) => patch({ showFooter: e.target.checked })} className="size-4" />
                    Footer
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={Boolean(config.showDraftWatermark)} onChange={(e) => patch({ showDraftWatermark: e.target.checked })} className="size-4" />
                    DRAFT watermark
                  </label>
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-[color:var(--wsu-border)] bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--wsu-muted)]">Step 3</p>
            <div className="mt-0.5 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-medium text-[color:var(--wsu-ink)]">What appears on the PDF</h3>
                <p className="mt-0.5 text-xs text-[color:var(--wsu-muted)]">
                  {includedCount} of {fieldCount} fields included. Click a row to rename it.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className={secondaryBtn} onClick={() => insertItem("heading")}>
                  <IconPlus className="h-3.5 w-3.5" /> Heading
                </button>
                <button type="button" className={secondaryBtn} onClick={() => insertItem("description")}>
                  <IconPlus className="h-3.5 w-3.5" /> Text
                </button>
                <button type="button" className={secondaryBtn} onClick={() => insertItem("divider")}>
                  <IconPlus className="h-3.5 w-3.5" /> Line
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="relative min-w-[12rem] flex-1">
                <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--wsu-muted)]" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find a field…"
                  className="w-full rounded-lg border border-[color:var(--wsu-border)] py-2 pl-8 pr-3 text-sm"
                />
              </label>
              <button type="button" className="text-xs font-medium text-[color:var(--wsu-muted)] hover:text-[color:var(--wsu-ink)]" onClick={() => {
                setItems((prev) => prev.map((row) => (row.kind === "field" ? { ...row, included: true } : row)));
                setDirty(true);
              }}>
                Include all
              </button>
              <button type="button" className="text-xs font-medium text-[color:var(--wsu-muted)] hover:text-[color:var(--wsu-ink)]" onClick={() => {
                setItems((prev) => prev.map((row) => (row.kind === "field" ? { ...row, included: false } : row)));
                setDirty(true);
              }}>
                Exclude all
              </button>
            </div>

            <ul className="mt-3 space-y-1.5">
              {filtered.length === 0 ? (
                <li className="rounded-lg border border-dashed border-[color:var(--wsu-border)] px-3 py-6 text-center text-sm text-[color:var(--wsu-muted)]">
                  {items.length === 0 ? "No visible form fields to include." : "No fields match that search."}
                </li>
              ) : (
                filtered.map(({ item, index }) => {
                  const expanded = expandedId === item.id;
                  const dimmed = item.kind === "field" && !item.included;
                  const summary =
                    item.kind === "field"
                      ? item.label?.trim() || item.columnTitle
                      : item.kind === "divider"
                        ? "Divider line"
                        : plainText(item.text) || (item.kind === "heading" ? "Heading" : "Text");
                  return (
                    <li
                      key={item.id}
                      className={`rounded-lg border border-[color:var(--wsu-border)] ${dimmed ? "bg-[color:var(--wsu-stone)]/50 opacity-70" : "bg-white"} ${expanded ? "ring-1 ring-wsu-crimson/20" : ""}`}
                    >
                      <div className="flex items-center gap-1.5 px-2 py-1.5">
                        <div className="flex shrink-0 flex-col">
                          <button type="button" className="rounded p-0.5 text-[color:var(--wsu-muted)] hover:bg-[color:var(--wsu-stone)] disabled:opacity-30" disabled={index === 0} onClick={() => moveItem(index, -1)} aria-label="Move up" title="Move up">
                            <IconChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" className="rounded p-0.5 text-[color:var(--wsu-muted)] hover:bg-[color:var(--wsu-stone)] disabled:opacity-30" disabled={index === items.length - 1} onClick={() => moveItem(index, 1)} aria-label="Move down" title="Move down">
                            <IconChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {item.kind === "field" ? (
                          <input
                            type="checkbox"
                            checked={item.included}
                            onChange={(e) => updateItem(item.id, (row) => (row.kind === "field" ? { ...row, included: e.target.checked } : row))}
                            className="size-4 shrink-0"
                            title={item.included ? "Included on PDF" : "Hidden from PDF"}
                          />
                        ) : null}
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
                          onClick={() => setExpandedId(expanded ? null : item.id)}
                        >
                          <span className="truncate text-sm font-medium text-[color:var(--wsu-ink)]">{summary}</span>
                          <KindBadge kind={item.kind} />
                        </button>
                        {item.kind !== "field" ? (
                          <button type="button" className={iconBtn} onClick={() => removeItem(item.id)} aria-label="Remove" title="Remove">
                            <IconTrash className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <IconChevronDown className={`h-3.5 w-3.5 shrink-0 text-[color:var(--wsu-muted)] transition-transform ${expanded ? "rotate-180" : ""}`} />
                        )}
                      </div>
                      {expanded && item.kind === "field" ? (
                        <div className="grid gap-2 border-t border-[color:var(--wsu-border)] px-3 py-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
                          <label className="block text-xs font-medium text-[color:var(--wsu-muted)]">
                            Label on PDF
                            <input
                              type="text"
                              value={item.label ?? ""}
                              placeholder={item.columnTitle}
                              onChange={(e) => updateItem(item.id, (row) => (row.kind === "field" ? { ...row, label: e.target.value } : row))}
                              className={inputClass}
                            />
                          </label>
                          <label className="block text-xs font-medium text-[color:var(--wsu-muted)]">
                            This field’s style
                            <select
                              value={item.display || config.fieldStyle || "inline"}
                              onChange={(e) => {
                                const display =
                                  e.target.value === "inline" || e.target.value === "underline" || e.target.value === "boxed"
                                    ? e.target.value
                                    : undefined;
                                updateItem(item.id, (row) => (row.kind === "field" ? { ...row, display } : row));
                              }}
                              className={inputClass}
                            >
                              <option value="inline">Inline</option>
                              <option value="boxed">Boxed</option>
                              <option value="underline">Underline</option>
                            </select>
                          </label>
                        </div>
                      ) : null}
                      {expanded && (item.kind === "heading" || item.kind === "description") ? (
                        <div className="border-t border-[color:var(--wsu-border)] px-3 py-3">
                          <HeaderCustomTextEditor
                            value={item.text}
                            placeholder={item.kind === "heading" ? "Section heading" : "Supporting text"}
                            compact={item.kind === "heading"}
                            onChange={(html) =>
                              updateItem(item.id, (row) =>
                                row.kind === "heading" || row.kind === "description" ? { ...row, text: html } : row,
                              )
                            }
                          />
                        </div>
                      ) : null}
                    </li>
                  );
                })
              )}
            </ul>
          </section>
        </div>

        <aside className={`min-h-0 flex-col overflow-hidden rounded-xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/40 ${mobilePane === "preview" ? "flex" : "hidden lg:flex"}`}>
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[color:var(--wsu-border)] bg-white px-3 py-2">
            <div>
              <p className="text-xs font-medium text-[color:var(--wsu-ink)]">Live preview</p>
              <p className="text-[11px] text-[color:var(--wsu-muted)]">
                {previewing ? "Updating…" : previewError ? "Couldn’t update preview" : "Sample values · updates as you edit"}
              </p>
            </div>
            {previewUrl ? (
              <a href={previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-wsu-crimson hover:underline">
                Open full size
                <IconExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
          {previewError ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm text-red-700">{previewError}</p>
              <button type="button" className={secondaryBtn} onClick={() => void refreshPreview(false)}>
                Try again
              </button>
            </div>
          ) : previewUrl ? (
            <object data={previewUrl} type="application/pdf" className="min-h-[28rem] flex-1 bg-white lg:min-h-0" title="PDF preview">
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="text-sm text-[color:var(--wsu-ink)]">This browser can’t show the PDF here.</p>
                <a href={previewUrl} target="_blank" rel="noreferrer" className={primaryBtn}>
                  Open PDF
                </a>
              </div>
            </object>
          ) : (
            <div className="flex flex-1 items-center justify-center px-6 text-sm text-[color:var(--wsu-muted)]">
              Generating preview…
            </div>
          )}
        </aside>
      </div>

      <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[color:var(--wsu-border)] bg-white/95 py-3">
        <p className={`text-xs ${dirty ? "font-medium text-amber-800" : "text-[color:var(--wsu-muted)]"}`}>
          {dirty ? "Unsaved changes · Ctrl/⌘ S to save" : "All changes saved"}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondaryBtn} onClick={() => void load()} disabled={saving} title="Reload saved settings">
            <IconRefresh className="h-3.5 w-3.5" />
            Reset
          </button>
          <button type="button" className={secondaryBtn} onClick={() => void refreshPreview(true)} disabled={previewing}>
            Open preview
          </button>
          <button type="button" className={primaryBtn} onClick={() => void save()} disabled={saving || !dirty}>
            {saving ? "Saving…" : dirty ? "Save PDF settings" : "Saved"}
          </button>
        </div>
      </div>
    </div>
  );
}
