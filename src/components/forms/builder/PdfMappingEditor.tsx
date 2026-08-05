"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { PdfCustomItem, PdfMappingConfig } from "@/lib/forms/pdf-mapping-types";
import {
  DEFAULT_PDF_OUTPUT_FILENAME,
  defaultPdfMappingConfig,
} from "@/lib/forms/pdf-mapping-types";
import { HeaderCustomTextEditor } from "@/components/ui/HeaderCustomTextEditor";
import {
  IconChevronDown,
  IconChevronUp,
  IconExternalLink,
  IconPlus,
  IconRefresh,
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
const ghostBtn =
  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[color:var(--wsu-muted)] hover:bg-[color:var(--wsu-stone)] hover:text-[color:var(--wsu-ink)]";

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
        items.push({
          ...item,
          label: item.label || fallback?.label,
        });
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
  const plain = (formTitle ?? "").replace(/<[^>]+>/g, "").trim() || "Final PDF";
  return {
    ...base,
    outputFileName: plain.toLowerCase().endsWith(".pdf") ? plain : `${plain}.pdf`,
  };
}

function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = true,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-xl border border-[color:var(--wsu-border)] bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <div>
          <h2 className="text-sm font-medium text-[color:var(--wsu-ink)]">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-[color:var(--wsu-muted)]">{subtitle}</p> : null}
        </div>
        <IconChevronDown className={`h-4 w-4 shrink-0 text-[color:var(--wsu-muted)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div className="border-t border-[color:var(--wsu-border)] px-4 py-4">{children}</div> : null}
    </section>
  );
}

function KindBadge({ kind }: { kind: PdfCustomItem["kind"] }) {
  const label = kind === "field" ? "Field" : kind === "heading" ? "Heading" : kind === "description" ? "Text" : "Divider";
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
  const [showAdvancedBranding, setShowAdvancedBranding] = useState(false);

  const columnTitles = useMemo(() => fieldOptions.map((o) => o.columnTitle), [fieldOptions]);
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
    setDirty(true);
  };

  const setAllFieldsIncluded = (included: boolean) => {
    setItems((prev) => prev.map((row) => (row.kind === "field" ? { ...row, included } : row)));
    setDirty(true);
  };

  const draftConfig = (): PdfMappingConfig => ({
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
  });

  const preview = async () => {
    setPreviewing(true);
    setMessage(null);
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
      const url = URL.createObjectURL(blob);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      window.open(url, "_blank", "noopener,noreferrer");
      setMessage({
        ok: true,
        text: "Preview opened in a new tab. If the panel below is blank, use that tab.",
      });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Preview failed." });
    } finally {
      setPreviewing(false);
    }
  };

  const save = async () => {
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
      setMessage({ ok: true, text: "PDF settings saved." });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Save failed." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-[color:var(--wsu-border)] bg-white p-6 text-sm text-[color:var(--wsu-muted)]">
        Loading PDF settings…
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-4">
        {message ? (
          <p className={`rounded-lg px-3 py-2 text-xs ${message.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
            {message.text}
          </p>
        ) : null}

        <section className="rounded-xl border border-[color:var(--wsu-border)] bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-[color:var(--wsu-ink)]">Submission PDF</h2>
              <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">
                Customize how the attached PDF looks, then preview with sample values.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 rounded-full border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/50 px-3 py-1.5 text-sm text-[color:var(--wsu-ink)]">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => patch({ enabled: e.target.checked })}
                className="size-4 rounded border-[color:var(--wsu-border)]"
              />
              Attach on submit
            </label>
          </div>
          <label className="mt-4 block text-xs font-medium text-[color:var(--wsu-ink)]">
            Output filename
            <input
              type="text"
              value={config.outputFileName}
              onChange={(e) => patch({ outputFileName: e.target.value })}
              className={`${inputClass} max-w-md`}
            />
          </label>
        </section>

        <CollapsibleSection
          title="Header & description"
          subtitle="Rich text for the PDF title and intro. Leave blank to use the form header."
        >
          <div className="space-y-4">
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-medium text-[color:var(--wsu-ink)]">PDF title</label>
                {formTitle ? (
                  <button type="button" className="text-[11px] font-medium text-wsu-crimson hover:underline" onClick={() => patch({ title: formTitle })}>
                    Use form title
                  </button>
                ) : null}
              </div>
              <HeaderCustomTextEditor
                value={config.title ?? ""}
                placeholder={formTitle?.replace(/<[^>]+>/g, "") || "Form title"}
                compact
                onChange={(html) => patch({ title: html })}
              />
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-medium text-[color:var(--wsu-ink)]">PDF description</label>
                {formDescription ? (
                  <button
                    type="button"
                    className="text-[11px] font-medium text-wsu-crimson hover:underline"
                    onClick={() => patch({ description: formDescription })}
                  >
                    Use form description
                  </button>
                ) : null}
              </div>
              <HeaderCustomTextEditor
                value={config.description ?? ""}
                placeholder={formDescription?.replace(/<[^>]+>/g, "") || "Optional intro text"}
                onChange={(html) => patch({ description: html })}
              />
            </div>

            <button type="button" className={ghostBtn} onClick={() => setShowAdvancedBranding((v) => !v)}>
              <IconChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvancedBranding ? "rotate-180" : ""}`} />
              {showAdvancedBranding ? "Hide logo, banner & footer" : "Logo, banner & footer"}
            </button>
            {showAdvancedBranding ? (
              <div className="space-y-3 rounded-lg border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/30 p-3">
                <label className="block text-xs font-medium text-[color:var(--wsu-ink)]">
                  Banner text
                  <input
                    type="text"
                    value={config.bannerText ?? ""}
                    placeholder="e.g. DRAFT – DO NOT SUBMIT THIS VERSION TO THE GRADUATE SCHOOL"
                    onChange={(e) => patch({ bannerText: e.target.value })}
                    className={inputClass}
                  />
                </label>
                <label className="block text-xs font-medium text-[color:var(--wsu-ink)]">
                  Footer text
                  <input type="text" value={config.footerText ?? ""} onChange={(e) => patch({ footerText: e.target.value })} className={inputClass} />
                </label>
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-[color:var(--wsu-ink)]">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={config.showLogo !== false} onChange={(e) => patch({ showLogo: e.target.checked })} className="size-4" />
                    Show logo
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={Boolean(config.showCrimsonBar)} onChange={(e) => patch({ showCrimsonBar: e.target.checked })} className="size-4" />
                    Crimson bar
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={config.showFooter !== false} onChange={(e) => patch({ showFooter: e.target.checked })} className="size-4" />
                    Show footer
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(config.showDraftWatermark)}
                      onChange={(e) => patch({ showDraftWatermark: e.target.checked })}
                      className="size-4"
                    />
                    DRAFT watermark
                  </label>
                </div>
              </div>
            ) : null}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Look & layout" subtitle="Theme, columns, spacing, and default field style." defaultOpen={false}>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs font-medium text-[color:var(--wsu-ink)]">
              Theme
              <select
                value={config.theme ?? "official"}
                onChange={(e) => {
                  const theme = e.target.value === "simple" || e.target.value === "wsu" ? e.target.value : "official";
                  patch({
                    theme,
                    ...(theme === "official"
                      ? {
                          layout: "twoColumn",
                          fieldStyle: "inline",
                          showCrimsonBar: false,
                          showDraftWatermark: true,
                          bannerText: config.bannerText || "DRAFT – DO NOT SUBMIT THIS VERSION TO THE GRADUATE SCHOOL",
                          footerText: config.footerText || "DRAFT – DO NOT SUBMIT THIS VERSION TO THE GRADUATE SCHOOL",
                        }
                      : {}),
                  });
                }}
                className={inputClass}
              >
                <option value="official">Official form (Smartsheet style)</option>
                <option value="wsu">WSU (boxed fields)</option>
                <option value="simple">Simple</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-[color:var(--wsu-ink)]">
              Layout
              <select
                value={config.layout ?? "twoColumn"}
                onChange={(e) => patch({ layout: e.target.value === "twoColumn" ? "twoColumn" : "stacked" })}
                className={inputClass}
              >
                <option value="stacked">One column</option>
                <option value="twoColumn">Two columns</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-[color:var(--wsu-ink)]">
              Spacing
              <select
                value={config.density ?? "comfortable"}
                onChange={(e) => patch({ density: e.target.value === "compact" ? "compact" : "comfortable" })}
                className={inputClass}
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-[color:var(--wsu-ink)] sm:col-span-3">
              Default field style
              <select
                value={config.fieldStyle ?? (config.theme === "official" ? "inline" : "boxed")}
                onChange={(e) =>
                  patch({
                    fieldStyle: e.target.value === "inline" || e.target.value === "underline" ? e.target.value : "boxed",
                  })
                }
                className={`${inputClass} max-w-md`}
              >
                <option value="boxed">Boxed (label above value)</option>
                <option value="inline">Inline (LABEL: value)</option>
                <option value="underline">Underline (value on line, label below)</option>
              </select>
            </label>
          </div>
        </CollapsibleSection>

        <section className="rounded-xl border border-[color:var(--wsu-border)] bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-[color:var(--wsu-ink)]">Fields & sections</h2>
              <p className="mt-0.5 text-xs text-[color:var(--wsu-muted)]">
                Use the arrows to reorder. Uncheck a field to leave it off the PDF.
              </p>
              <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">
                {includedCount} of {fieldCount} fields included
                {columnTitles.length ? ` · ${columnTitles.length} available` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={secondaryBtn}
                onClick={() => {
                  setItems((prev) => [...prev, { id: newId("heading"), kind: "heading", text: "Section heading" }]);
                  setDirty(true);
                }}
              >
                <IconPlus className="h-3.5 w-3.5" />
                Heading
              </button>
              <button
                type="button"
                className={secondaryBtn}
                onClick={() => {
                  setItems((prev) => [...prev, { id: newId("description"), kind: "description", text: "Supporting text" }]);
                  setDirty(true);
                }}
              >
                <IconPlus className="h-3.5 w-3.5" />
                Text
              </button>
              <button
                type="button"
                className={secondaryBtn}
                onClick={() => {
                  setItems((prev) => [...prev, { id: newId("divider"), kind: "divider" }]);
                  setDirty(true);
                }}
              >
                <IconPlus className="h-3.5 w-3.5" />
                Divider
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={ghostBtn} onClick={() => setAllFieldsIncluded(true)}>
              Include all fields
            </button>
            <button type="button" className={ghostBtn} onClick={() => setAllFieldsIncluded(false)}>
              Exclude all fields
            </button>
          </div>

          <ul className="mt-3 space-y-2">
            {items.length === 0 ? (
              <li className="rounded-lg border border-dashed border-[color:var(--wsu-border)] px-3 py-6 text-center text-sm text-[color:var(--wsu-muted)]">
                No visible form fields to include.
              </li>
            ) : (
              items.map((item, index) => {
                const dimmed = item.kind === "field" && !item.included;
                return (
                  <li
                    key={item.id}
                    className={`rounded-lg border border-[color:var(--wsu-border)] p-3 ${dimmed ? "bg-[color:var(--wsu-stone)]/40 opacity-70" : "bg-white"}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex shrink-0 flex-col gap-1 pt-0.5">
                        <button
                          type="button"
                          className={iconBtn}
                          disabled={index === 0}
                          onClick={() => moveItem(index, -1)}
                          aria-label={`Move ${item.kind} up`}
                          title="Move up"
                        >
                          <IconChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className={iconBtn}
                          disabled={index === items.length - 1}
                          onClick={() => moveItem(index, 1)}
                          aria-label={`Move ${item.kind} down`}
                          title="Move down"
                        >
                          <IconChevronDown className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="min-w-0 flex-1 space-y-2">
                        {item.kind === "field" ? (
                          <>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <label className="flex min-w-0 items-center gap-2 text-sm text-[color:var(--wsu-ink)]">
                                <input
                                  type="checkbox"
                                  checked={item.included}
                                  onChange={(e) => {
                                    const included = e.target.checked;
                                    updateItem(item.id, (row) => (row.kind === "field" ? { ...row, included } : row));
                                  }}
                                  className="size-4"
                                />
                                <span className="truncate font-medium">{item.columnTitle}</span>
                              </label>
                              <KindBadge kind="field" />
                            </div>
                            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem]">
                              <label className="block text-xs font-medium text-[color:var(--wsu-muted)]">
                                PDF label
                                <input
                                  type="text"
                                  value={item.label ?? ""}
                                  placeholder={item.columnTitle}
                                  onChange={(e) => {
                                    const label = e.target.value;
                                    updateItem(item.id, (row) => (row.kind === "field" ? { ...row, label } : row));
                                  }}
                                  className={inputClass}
                                />
                              </label>
                              <label className="block text-xs font-medium text-[color:var(--wsu-muted)]">
                                Display
                                <select
                                  value={item.display || config.fieldStyle || "boxed"}
                                  onChange={(e) => {
                                    const display =
                                      e.target.value === "inline" || e.target.value === "underline" || e.target.value === "boxed"
                                        ? e.target.value
                                        : undefined;
                                    updateItem(item.id, (row) => (row.kind === "field" ? { ...row, display } : row));
                                  }}
                                  className={inputClass}
                                >
                                  <option value="boxed">Boxed</option>
                                  <option value="inline">Inline LABEL: value</option>
                                  <option value="underline">Underline</option>
                                </select>
                              </label>
                            </div>
                          </>
                        ) : item.kind === "divider" ? (
                          <div className="flex items-center justify-between gap-2 py-1">
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <KindBadge kind="divider" />
                              <div className="h-px flex-1 bg-[color:var(--wsu-border)]" />
                            </div>
                            <button type="button" className={iconBtn} onClick={() => removeItem(item.id)} aria-label="Remove divider" title="Remove">
                              <IconTrash className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <KindBadge kind={item.kind} />
                              <button
                                type="button"
                                className={iconBtn}
                                onClick={() => removeItem(item.id)}
                                aria-label={`Remove ${item.kind}`}
                                title="Remove"
                              >
                                <IconTrash className="h-4 w-4" />
                              </button>
                            </div>
                            <HeaderCustomTextEditor
                              value={item.text}
                              placeholder={item.kind === "heading" ? "Section heading" : "Supporting text"}
                              compact={item.kind === "heading"}
                              onChange={(html) => {
                                updateItem(item.id, (row) =>
                                  row.kind === "heading" || row.kind === "description" ? { ...row, text: html } : row,
                                );
                              }}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </section>

        {previewUrl ? (
          <section className="overflow-hidden rounded-xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/30">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--wsu-border)] bg-white px-4 py-2 text-xs text-[color:var(--wsu-muted)]">
              <span>Sample preview (placeholder values)</span>
              <a href={previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-wsu-crimson hover:underline">
                Open in new tab
                <IconExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <object data={previewUrl} type="application/pdf" className="h-[520px] w-full bg-white" title="PDF preview">
              <div className="flex h-[520px] flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="text-sm text-[color:var(--wsu-ink)]">Your browser can’t show PDFs in this panel.</p>
                <a href={previewUrl} target="_blank" rel="noreferrer" className={primaryBtn}>
                  Open PDF in new tab
                </a>
              </div>
            </object>
          </section>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[color:var(--wsu-border)] bg-white/95 px-1 py-3 backdrop-blur">
        <p className={`text-xs ${dirty ? "font-medium text-amber-800" : "text-[color:var(--wsu-muted)]"}`}>
          {dirty ? "Unsaved changes" : "All changes saved"}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondaryBtn} onClick={() => void load()} disabled={saving || previewing} title="Reload saved settings">
            <IconRefresh className="h-3.5 w-3.5" />
            Refresh
          </button>
          <button type="button" className={secondaryBtn} onClick={() => void preview()} disabled={saving || previewing}>
            {previewing ? "Generating…" : "Preview PDF"}
          </button>
          {previewUrl ? (
            <a href={previewUrl} target="_blank" rel="noreferrer" className={secondaryBtn}>
              <IconExternalLink className="h-3.5 w-3.5" />
              Open preview
            </a>
          ) : null}
          <button type="button" className={primaryBtn} onClick={() => void save()} disabled={saving || !dirty}>
            {saving ? "Saving…" : dirty ? "Save settings" : "Saved"}
          </button>
        </div>
      </div>
    </div>
  );
}
