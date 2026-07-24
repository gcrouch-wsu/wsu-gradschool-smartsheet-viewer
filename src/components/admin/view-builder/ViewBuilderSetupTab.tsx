"use client";

import type { Dispatch, SetStateAction } from "react";
import { HeaderCustomTextEditor } from "@/components/ui/HeaderCustomTextEditor";
import { HeaderLogoBrandingSection } from "../HeaderLogoBrandingSection";
import { ThemeEditor } from "../ThemeEditor";
import {
  CARD_LAYOUT_CAMPUS_BADGES,
  CARD_LAYOUT_PLACEHOLDER,
  CARD_LAYOUT_TEXT_PREFIX,
} from "@/lib/config/types";
import { VIEW_TEMPLATES } from "@/lib/config/templates";
import { LAYOUT_OPTIONS, formatLayoutLabel } from "@/lib/config/options";
import { DISPLAY_TIMEZONE_OPTIONS, effectiveViewDisplayTimeZone } from "@/lib/display-datetime";
import { publicInteractiveHref } from "@/lib/public-view-href";
import { slugify } from "@/lib/utils";
import type { SourceConfig, ViewConfig } from "@/lib/config/types";
import type { ResolvedView } from "@/lib/config/types";
import { SetupAccordion } from "./SetupAccordion";
import { VisibilitySelect } from "./VisibilitySelect";
import { ViewBuilderLivePreview } from "./ViewBuilderLivePreview";
import { createEditingConfigState, parseOptionalNumber, type ExistingViewMeta } from "./view-builder-utils";

export function ViewBuilderSetupTab({
  view,
  setView,
  sources,
  isNew,
  sourceMap,
  duplicateIdView,
  duplicateLabelViews,
  sharedSlugViews,
  singlePublishedOnSlug,
  update,
  applyTemplate,
  lastAppliedTemplateId,
  duplicateView,
  previewHref,
  livePreview,
  livePreviewLoading,
  livePreviewError,
}: {
  view: ViewConfig;
  setView: Dispatch<SetStateAction<ViewConfig>>;
  sources: SourceConfig[];
  isNew: boolean;
  sourceMap: Map<string, string>;
  duplicateIdView: ExistingViewMeta | null;
  duplicateLabelViews: ExistingViewMeta[];
  sharedSlugViews: ExistingViewMeta[];
  singlePublishedOnSlug: boolean;
  update: <K extends keyof ViewConfig>(key: K, value: ViewConfig[K]) => void;
  applyTemplate: (templateId: string) => void;
  lastAppliedTemplateId: string | null;
  duplicateView: () => void | Promise<void>;
  previewHref: string | null;
  livePreview: { resolvedView: ResolvedView; warnings: string[] } | null;
  livePreviewLoading: boolean;
  livePreviewError: string | null;
}) {
  return (
    <div id="tabpanel-setup" role="tabpanel" aria-labelledby="tab-setup" className="mt-6 space-y-3">
            <SetupAccordion
              title="Layout presets"
              subtitle="Templates for table, cards, accordion, and more. Add columns on the Fields tab when ready."
            >
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {VIEW_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTemplate(template.id)}
                    className={`min-h-[44px] rounded-[1.5rem] border p-4 text-left transition ${
                      lastAppliedTemplateId === template.id
                        ? "border-[color:var(--wsu-crimson)] bg-[color:var(--wsu-crimson)]/5"
                        : "border-[color:var(--wsu-border)] bg-white hover:border-[color:var(--wsu-crimson)]"
                    }`}
                  >
                    <p className="text-sm font-semibold text-[color:var(--wsu-ink)]">{template.label}</p>
                    <p className="mt-2 text-sm text-[color:var(--wsu-muted)]">{template.description}</p>
                  </button>
                ))}
              </div>
            </SetupAccordion>

            <SetupAccordion title="Source & page identity" subtitle="Smartsheet source, URL slug, labels, and validation warnings.">
            <div className="grid gap-4 md:grid-cols-2">
          <label className="flex min-h-[72px] flex-col justify-center gap-1 text-sm">
            <span className="font-medium text-[color:var(--wsu-ink)]">Source</span>
            <select
              value={view.sourceId}
              onChange={(event) => {
                const sourceId = event.target.value;
                const source = sources.find((s) => s.id === sourceId);
                setView((prev) => ({
                  ...prev,
                  sourceId,
                  label: prev.label || (source?.label ?? ""),
                  slug: prev.slug || (source?.label ? slugify(source.label) : prev.slug),
                  id: isNew && !prev.id ? (source?.label ? slugify(source.label) : prev.id) : prev.id,
                }));
              }}
              className="w-full rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-3"
            >
              {sources.map((source) => (
                <option key={source.id} value={source.id}>{source.label}</option>
              ))}
            </select>
            <p className="text-xs text-[color:var(--wsu-muted)]">Label, slug, and ID auto-fill from the source when empty.</p>
          </label>
          <label className="flex min-h-[72px] flex-col justify-center gap-1 text-sm">
            <span className="font-medium text-[color:var(--wsu-ink)]">Label</span>
            <input
              value={view.label}
              onChange={(event) => {
                const label = event.target.value;
                setView((prev) => ({
                  ...prev,
                  label,
                  slug: prev.slug || slugify(label),
                  id: isNew && !prev.id ? slugify(label) : prev.id,
                }));
              }}
              className="w-full rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-3"
            />
            <p className="text-xs text-[color:var(--wsu-muted)]">Display name. Slug and ID auto-derive when empty.</p>
          </label>
          <label className="flex min-h-[72px] flex-col justify-center gap-1 text-sm">
            <span className="font-medium text-[color:var(--wsu-ink)]">Slug</span>
            <input
              value={view.slug}
              onChange={(event) => {
                const slug = event.target.value;
                setView((prev) => ({
                  ...prev,
                  slug,
                  id: isNew && !prev.id ? slug : prev.id,
                }));
              }}
              className="w-full rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-3"
            />
            <p className="text-xs text-[color:var(--wsu-muted)]">URL path (e.g. /view/graduate-programs). ID syncs when empty.</p>
          </label>
          <label className="flex min-h-[72px] flex-col justify-center gap-1 text-sm">
            <span className="font-medium text-[color:var(--wsu-ink)]">View ID</span>
            <input
              value={view.id}
              disabled={!isNew}
              onChange={(event) => update("id", event.target.value)}
              className="w-full rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-3 disabled:bg-[color:var(--wsu-stone)]"
            />
            <p className="text-xs text-[color:var(--wsu-muted)]">Unique identifier. Set once at creation; cannot be changed.</p>
          </label>
          <label className="flex min-h-[72px] flex-col justify-center gap-1 text-sm md:col-span-2">
            <span className="font-medium text-[color:var(--wsu-ink)]">Description</span>
            <textarea
              value={view.description ?? ""}
              onChange={(event) => update("description", event.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-3"
            />
          </label>
          {(duplicateIdView || duplicateLabelViews.length > 0 || sharedSlugViews.length > 0) && (
            <div className="space-y-3 md:col-span-2">
              {duplicateIdView && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  <p className="font-semibold text-rose-900">View ID already exists</p>
                  <p className="mt-1">
                    The new view ID <span className="font-mono">{view.id || "(empty)"}</span> is already used by{" "}
                    <strong>{duplicateIdView.label || duplicateIdView.id}</strong>. Saving a new view with that ID would
                    target the existing record, so create is blocked until you change the View ID.
                  </p>
                </div>
              )}
              {duplicateLabelViews.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <p className="font-semibold text-amber-950">Another view already uses this label</p>
                  <p className="mt-1">
                    {duplicateLabelViews.map((candidate) => candidate.label || candidate.id).join(", ")} already use{" "}
                    <strong>{view.label || "(empty label)"}</strong>. This does not overwrite anything by itself, but it can
                    make the admin list harder to distinguish.
                  </p>
                </div>
              )}
              {sharedSlugViews.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <p className="font-semibold text-amber-950">This slug is already in use</p>
                  <p className="mt-1">
                    {sharedSlugViews.map((candidate) => candidate.label || candidate.id).join(", ")} already publish to{" "}
                    <span className="font-mono">/view/{view.slug}</span>. Shared slugs create multiple tabs on the same
                    public page, which may be intentional.
                  </p>
                </div>
              )}
            </div>
          )}
            </div>
            </SetupAccordion>

            <SetupAccordion
              title="Layout & row headings"
              subtitle="Override layout, tab order, and primary/subtitle fields for card-style arrangements."
            >
            <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-[color:var(--wsu-ink)]">Layout (override)</span>
              <p className="text-xs text-[color:var(--wsu-muted)]">Override the template layout if you want the same fields in a different arrangement (e.g. cards instead of table).</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {LAYOUT_OPTIONS.map((layout) => (
                  <button
                    key={layout}
                    type="button"
                    onClick={() => update("layout", layout)}
                    className={`min-h-[44px] rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                      view.layout === layout
                        ? "border-[color:var(--wsu-crimson)] bg-[color:var(--wsu-crimson)]/5"
                        : "border-[color:var(--wsu-border)] bg-white hover:border-[color:var(--wsu-crimson)]"
                    }`}
                  >
                    {formatLayoutLabel(layout)}
                  </button>
                ))}
              </div>
            </div>
          <label className="flex min-h-[72px] flex-col justify-center gap-1 text-sm">
            <span className="font-medium text-[color:var(--wsu-ink)]">Tab order</span>
            <input
              type="number"
              value={view.tabOrder ?? 1}
              onChange={(event) => update("tabOrder", parseOptionalNumber(event.target.value) ?? 1)}
              className="w-full rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-3"
            />
          </label>
          <label className="flex min-h-[72px] flex-col justify-center gap-1 text-sm">
            <span className="font-medium text-[color:var(--wsu-ink)]">Heading field key</span>
            <p className="text-xs text-[color:var(--wsu-muted)]">Main title for cards and accordions. Can also be set in the Fields tab.</p>
            <select
              value={view.presentation?.headingFieldKey ?? ""}
              onChange={(event) => update("presentation", { ...view.presentation, headingFieldKey: event.target.value })}
              className="w-full rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-3 min-h-[44px]"
            >
              <option value="">Default (First field)</option>
              {view.fields.map((f) => (
                <option key={f.key} value={f.key}>{f.label || f.key}</option>
              ))}
            </select>
          </label>
          <label className="flex min-h-[72px] flex-col justify-center gap-1 text-sm">
            <span className="font-medium text-[color:var(--wsu-ink)]">Summary field key</span>
            <p className="text-xs text-[color:var(--wsu-muted)]">Sub-heading or secondary text. Can also be set in the Fields tab.</p>
            <select
              value={view.presentation?.summaryFieldKey ?? ""}
              onChange={(event) => update("presentation", { ...view.presentation, summaryFieldKey: event.target.value })}
              className="w-full rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-3 min-h-[44px]"
            >
              <option value="">Default (Second field)</option>
              {view.fields.map((f) => (
                <option key={f.key} value={f.key}>{f.label || f.key}</option>
              ))}
            </select>
          </label>

            </div>
            </SetupAccordion>

          {["cards", "list", "stacked", "accordion", "tabbed", "list_detail"].includes(view.layout) && (
            <SetupAccordion
              title="Custom card layout"
              subtitle="Per-card rows of fields, placeholders, and static labels."
            >
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-[color:var(--wsu-ink)]">Enable & arrange</span>
                <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">
                  Define rows and which fields appear in each. Multiple fields in a row appear side-by-side. Every field slot must use a{" "}
                  <strong className="font-medium text-[color:var(--wsu-ink)]">key</strong> that still exists on the{" "}
                  <strong className="font-medium text-[color:var(--wsu-ink)]">Fields</strong> tab (not just the display label).
                </p>
                <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950">
                  <strong className="font-semibold">Warning:</strong> If you delete a field, change its key, or replace several columns with one{" "}
                  <strong className="font-medium">grouped role / people</strong> field, come back here and update or remove the affected rows. Otherwise save will
                  report which row still points at an old key.
                </p>
              </div>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={(view.presentation?.cardLayout?.length ?? 0) > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      update("presentation", { ...view.presentation, cardLayout: view.fields.length > 0 ? [{ fieldKeys: [view.fields[0]!.key] }] : [] });
                    } else {
                      update("presentation", { ...view.presentation, cardLayout: undefined });
                    }
                  }}
                  className="rounded border-[color:var(--wsu-border)]"
                />
                <span>Use custom layout</span>
              </label>
              {(view.presentation?.cardLayout?.length ?? 0) > 0 && (
                <div className="space-y-3">
                  {view.presentation!.cardLayout!.map((row, rowIndex) => (
                    <div key={rowIndex} className="rounded-xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/20 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-[color:var(--wsu-ink)]">Row {rowIndex + 1}</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...(view.presentation?.cardLayout ?? [])];
                              const prev = next[rowIndex - 1];
                              if (prev) {
                                [next[rowIndex - 1], next[rowIndex]] = [next[rowIndex], prev];
                                update("presentation", { ...view.presentation, cardLayout: next });
                              }
                            }}
                            disabled={rowIndex === 0}
                            className="rounded border border-[color:var(--wsu-border)] px-2 py-1 text-xs disabled:opacity-40"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...(view.presentation?.cardLayout ?? [])];
                              const nxt = next[rowIndex + 1];
                              if (nxt) {
                                [next[rowIndex], next[rowIndex + 1]] = [nxt, next[rowIndex]];
                                update("presentation", { ...view.presentation, cardLayout: next });
                              }
                            }}
                            disabled={rowIndex === (view.presentation?.cardLayout?.length ?? 0) - 1}
                            className="rounded border border-[color:var(--wsu-border)] px-2 py-1 text-xs disabled:opacity-40"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const next = (view.presentation?.cardLayout ?? []).filter((_, i) => i !== rowIndex);
                              update("presentation", { ...view.presentation, cardLayout: next.length > 0 ? next : undefined });
                            }}
                            className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700"
                          >
                            Remove row
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {row.fieldKeys.map((key, keyIndex) => {
                          const isPlaceholder = key === CARD_LAYOUT_PLACEHOLDER;
                          const isCampusBadges = key === CARD_LAYOUT_CAMPUS_BADGES;
                          const isStaticText = key.startsWith(CARD_LAYOUT_TEXT_PREFIX);
                          const staticLabel = isStaticText ? key.slice(CARD_LAYOUT_TEXT_PREFIX.length) : "";
                          const field = view.fields.find((f) => f.key === key);
                          const keys = row.fieldKeys;
                          return (
                            <span
                              key={key}
                              className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-medium text-[color:var(--wsu-ink)] border border-[color:var(--wsu-border)]"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  if (keyIndex <= 0) return;
                                  const next = [...(view.presentation?.cardLayout ?? [])];
                                  const nextKeys = [...keys];
                                  [nextKeys[keyIndex - 1], nextKeys[keyIndex]] = [nextKeys[keyIndex]!, nextKeys[keyIndex - 1]!];
                                  next[rowIndex] = { fieldKeys: nextKeys };
                                  update("presentation", { ...view.presentation, cardLayout: next });
                                }}
                                disabled={keyIndex === 0}
                                className="text-[color:var(--wsu-muted)] hover:text-[color:var(--wsu-crimson)] disabled:opacity-40"
                                title="Move left"
                              >
                                ←
                              </button>
                              {isPlaceholder ? (
                                <span className="italic text-[color:var(--wsu-muted)]">(placeholder)</span>
                              ) : isCampusBadges ? (
                                <span className="text-[color:var(--wsu-crimson)]">Campus badges</span>
                              ) : isStaticText ? (
                                <span className="text-[color:var(--wsu-muted)]">&quot;{staticLabel}&quot;</span>
                              ) : (
                                field?.label ?? key
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  if (keyIndex >= keys.length - 1) return;
                                  const next = [...(view.presentation?.cardLayout ?? [])];
                                  const nextKeys = [...keys];
                                  [nextKeys[keyIndex], nextKeys[keyIndex + 1]] = [nextKeys[keyIndex + 1]!, nextKeys[keyIndex]!];
                                  next[rowIndex] = { fieldKeys: nextKeys };
                                  update("presentation", { ...view.presentation, cardLayout: next });
                                }}
                                disabled={keyIndex === keys.length - 1}
                                className="text-[color:var(--wsu-muted)] hover:text-[color:var(--wsu-crimson)] disabled:opacity-40"
                                title="Move right"
                              >
                                →
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...(view.presentation?.cardLayout ?? [])];
                                  const nextKeys = next[rowIndex]!.fieldKeys.filter((_, i) => i !== keyIndex);
                                  next[rowIndex] = { fieldKeys: nextKeys };
                                  if (nextKeys.length === 0) {
                                    next.splice(rowIndex, 1);
                                  }
                                  update("presentation", { ...view.presentation, cardLayout: next.length > 0 ? next : undefined });
                                }}
                                className="ml-1 text-[color:var(--wsu-muted)] hover:text-rose-600"
                                title="Remove from row"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                        <select
                          value=""
                          onChange={(e) => {
                            const key = e.target.value;
                            if (!key) return;
                            const next = [...(view.presentation?.cardLayout ?? [])];
                            const nextKeys = [...(next[rowIndex]?.fieldKeys ?? []), key];
                            next[rowIndex] = { fieldKeys: nextKeys };
                            update("presentation", { ...view.presentation, cardLayout: next });
                            e.target.value = "";
                          }}
                          className="rounded border border-[color:var(--wsu-border)] bg-white px-2 py-1 text-xs min-h-[32px]"
                        >
                          <option value="">Add field</option>
                          <option value={CARD_LAYOUT_PLACEHOLDER}>Add placeholder (blank for alignment)</option>
                          {view.presentation?.campusFieldKey &&
                          !row.fieldKeys.includes(CARD_LAYOUT_CAMPUS_BADGES) ? (
                            <option value={CARD_LAYOUT_CAMPUS_BADGES}>Campus badges (union)</option>
                          ) : null}
                          {view.fields
                            .filter((f) => !row.fieldKeys.includes(f.key))
                            .map((f) => (
                              <option key={f.key} value={f.key}>{f.label || f.key}</option>
                            ))}
                        </select>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            placeholder="Static text label"
                            className="w-28 rounded border border-[color:var(--wsu-border)] bg-white px-2 py-1 text-xs"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const input = e.currentTarget;
                                const label = input.value.trim();
                                if (label) {
                                  const key = `${CARD_LAYOUT_TEXT_PREFIX}${label}`;
                                  const next = [...(view.presentation?.cardLayout ?? [])];
                                  const nextKeys = [...(next[rowIndex]?.fieldKeys ?? []), key];
                                  next[rowIndex] = { fieldKeys: nextKeys };
                                  update("presentation", { ...view.presentation, cardLayout: next });
                                  input.value = "";
                                }
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              const input = (e.currentTarget as HTMLButtonElement).parentElement?.querySelector("input[type='text']") as HTMLInputElement | null;
                              const label = input?.value?.trim();
                              if (label) {
                                const key = `${CARD_LAYOUT_TEXT_PREFIX}${label}`;
                                const next = [...(view.presentation?.cardLayout ?? [])];
                                const nextKeys = [...(next[rowIndex]?.fieldKeys ?? []), key];
                                next[rowIndex] = { fieldKeys: nextKeys };
                                update("presentation", { ...view.presentation, cardLayout: next });
                                if (input) input.value = "";
                              }
                            }}
                            className="rounded border border-[color:var(--wsu-border)] px-2 py-1 text-xs"
                          >
                            Add text
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const next = [...(view.presentation?.cardLayout ?? []), { fieldKeys: [] }];
                      update("presentation", { ...view.presentation, cardLayout: next });
                    }}
                    className="rounded border border-[color:var(--wsu-border)] bg-white px-3 py-1.5 text-sm font-medium"
                  >
                    Add row
                  </button>
                </div>
              )}
            </div>
            </SetupAccordion>
          )}

          {["cards", "list", "stacked", "accordion", "tabbed", "list_detail"].includes(view.layout) && (
            <SetupAccordion title="Row dividers & badges" subtitle="Spacing between cards/lists and optional row badges.">
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Row dividers</label>
                  <select
                    value={view.presentation?.rowDividerStyle ?? "default"}
                    onChange={(e) => update("presentation", { ...view.presentation, rowDividerStyle: e.target.value as "default" | "subtle" | "none" })}
                    className="w-full max-w-xs rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                  >
                    <option value="default">Default</option>
                    <option value="subtle">Subtle</option>
                    <option value="none">None</option>
                  </select>
                  <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">Divider between rows/cards.</p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={view.presentation?.hideRowBadge ?? false}
                    onChange={(e) => update("presentation", { ...view.presentation, hideRowBadge: e.target.checked })}
                    className="rounded border-[color:var(--wsu-border)]"
                  />
                  <span>Hide row badge</span>
                </label>
              </div>
            </SetupAccordion>
          )}

          <SetupAccordion
            title="Email & phone links (public view)"
            subtitle="Whether contact emails and phone numbers from Smartsheet are clickable on the live page. Print/PDF always stays plain text."
          >
            <div className="space-y-4">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={view.presentation?.linkEmailsInView !== false}
                  onChange={(e) =>
                    update("presentation", {
                      ...view.presentation,
                      linkEmailsInView: e.target.checked ? true : false,
                    })
                  }
                  className="mt-0.5 rounded border-[color:var(--wsu-border)]"
                />
                <span>
                  <span className="font-medium text-[color:var(--wsu-ink)]">Link email addresses</span>
                  <span className="mt-0.5 block text-xs text-[color:var(--wsu-muted)]">Default: on (mailto links).</span>
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={view.presentation?.linkPhonesInView === true}
                  onChange={(e) =>
                    update("presentation", {
                      ...view.presentation,
                      linkPhonesInView: e.target.checked,
                    })
                  }
                  className="mt-0.5 rounded border-[color:var(--wsu-border)]"
                />
                <span>
                  <span className="font-medium text-[color:var(--wsu-ink)]">Link phone numbers</span>
                  <span className="mt-0.5 block text-xs text-[color:var(--wsu-muted)]">Default: off (plain text).</span>
                </span>
              </label>
            </div>
          </SetupAccordion>

          <SetupAccordion
            title="Print / PDF grouping"
            subtitle="Optional: group rows on the print route by one field (e.g. program name) so each group gets its own table—helpful when many Smartsheet rows share the same program."
          >
            <div className="space-y-2">
              <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Group print tables by field</label>
              <select
                value={view.presentation?.printGroupByFieldKey ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  update("presentation", {
                    ...view.presentation,
                    printGroupByFieldKey: v || undefined,
                  });
                }}
                className="w-full max-w-md rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
              >
                <option value="">None (single table)</option>
                {view.fields
                  .filter((f) => f.render.type !== "hidden")
                  .map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label || f.key}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-[color:var(--wsu-muted)]">
                Applies only to <code className="rounded bg-black/[0.04] px-1 py-0.5 text-[10px]">/view/…/print</code>. The interactive
                layouts are unchanged.
              </p>
            </div>
          </SetupAccordion>

          <SetupAccordion
            title="Hide file links (row status)"
            subtitle="Anonymous visitors and print/JSON do not see the whole row when status matches. Signed-in contributors (and admin editors) still see the row with an amber status chip and collapsed details so they can change status and file links."
          >
            <div className="space-y-4 text-sm">
              {view.fields.length === 0 ? (
                <p className="text-xs text-[color:var(--wsu-muted)]">Add fields on the Fields tab first.</p>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Status field</label>
                    <p className="mb-1.5 text-[10px] text-[color:var(--wsu-muted)]">
                      Picklist (or text) on each row — e.g. <strong>Hide</strong>, <strong>Delete</strong>, Published.
                    </p>
                    <select
                      value={view.presentation?.recordSuppressedFileStatusFieldKey ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        update("presentation", {
                          ...view.presentation,
                          recordSuppressedFileStatusFieldKey: v || undefined,
                        });
                      }}
                      className="w-full max-w-md rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Off</option>
                      {view.fields.map((f) => (
                        <option key={f.key} value={f.key}>
                          {(f.label || f.key) + (f.render.type === "hidden" ? " (hidden)" : "")}
                        </option>
                      ))}
                    </select>
                  </div>
                  {view.presentation?.recordSuppressedFileStatusFieldKey ? (
                    <>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">
                          Status values that hide file links
                        </label>
                        <p className="mb-1.5 text-[10px] text-[color:var(--wsu-muted)]">
                          Comma-separated; comparison is case-insensitive. Default when empty: hide, delete.
                        </p>
                        <input
                          value={(view.presentation.recordSuppressedFileStatusValues ?? ["hide", "delete"]).join(", ")}
                          onChange={(e) => {
                            const parts = e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean);
                            update("presentation", {
                              ...view.presentation,
                              recordSuppressedFileStatusValues: parts.length ? parts : undefined,
                            });
                          }}
                          className="w-full max-w-md rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                          placeholder="hide, delete"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">
                          Field keys to redact (optional)
                        </label>
                        <p className="mb-1.5 text-[10px] text-[color:var(--wsu-muted)]">
                          Comma-separated field keys. Leave empty to redact every field with display type <strong>link</strong>.
                        </p>
                        <input
                          value={(view.presentation.recordSuppressedFileRedactFieldKeys ?? []).join(", ")}
                          onChange={(e) => {
                            const parts = e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean)
                              .filter((k) => view.fields.some((f) => f.key === k));
                            update("presentation", {
                              ...view.presentation,
                              recordSuppressedFileRedactFieldKeys: parts.length ? parts : undefined,
                            });
                          }}
                          className="w-full max-w-lg rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 font-mono text-xs"
                          placeholder="handbook_pdf, resource_url"
                        />
                      </div>
                      <label className="flex items-start gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={view.presentation.recordSuppressedFileHideStatusFieldInPublicBody !== false}
                          onChange={(e) =>
                            update("presentation", {
                              ...view.presentation,
                              recordSuppressedFileHideStatusFieldInPublicBody: e.target.checked ? true : false,
                            })
                          }
                          className="mt-0.5 rounded border-[color:var(--wsu-border)]"
                        />
                        <span>
                          <span className="font-medium text-[color:var(--wsu-ink)]">Hide status column from record body</span>
                          <span className="mt-0.5 block text-xs text-[color:var(--wsu-muted)]">
                            Status still shows on the collapsed chip; contributors editing the row can still change status in the form when
                            that column is editable.
                          </span>
                        </span>
                      </label>
                    </>
                  ) : null}
                </>
              )}
            </div>
          </SetupAccordion>

          <SetupAccordion
            title="Campus & program grouping (live view)"
            subtitle="Use program + campus fields for section grouping, row merge (same contact email), or both. Accordion/tabbed/list/detail use stacked sections when section grouping is on."
          >
            <div className="space-y-4">
              {view.fields.length === 0 ? (
                <p className="text-xs text-[color:var(--wsu-muted)]">Add fields on the Fields tab first.</p>
              ) : (
                <>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Program field</label>
                      <p className="mb-1.5 text-[10px] text-[color:var(--wsu-muted)]">
                        Program name (or id) — used for section titles and/or merge grouping.
                      </p>
                      <select
                        value={view.presentation?.programGroupFieldKey ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          update("presentation", {
                            ...view.presentation,
                            programGroupFieldKey: v || undefined,
                          });
                        }}
                        className="w-full max-w-md rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                      >
                        <option value="">Select field…</option>
                        {view.fields.map((f) => (
                          <option key={f.key} value={f.key}>
                            {(f.label || f.key) + (f.render.type === "hidden" ? " (hidden)" : "")}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Campus field</label>
                      <p className="mb-1.5 text-[10px] text-[color:var(--wsu-muted)]">
                        Campus on each row — badges, filters, merge, and print use this.
                      </p>
                      <select
                        value={view.presentation?.campusFieldKey ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          update("presentation", {
                            ...view.presentation,
                            campusFieldKey: v || undefined,
                          });
                        }}
                        className="w-full max-w-md rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                      >
                        <option value="">Select field…</option>
                        {view.fields.map((f) => (
                          <option key={f.key} value={f.key}>
                            {(f.label || f.key) + (f.render.type === "hidden" ? " (hidden)" : "")}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <label className="flex items-start gap-3 border-t border-[color:var(--wsu-border)] pt-4 text-sm">
                    <input
                      type="checkbox"
                      checked={view.presentation?.campusGroupingMode === "grouped"}
                      onChange={(e) => {
                        const on = e.target.checked;
                        update("presentation", {
                          ...view.presentation,
                          ...(on
                            ? {
                                campusGroupingMode: "grouped",
                                showCampusFilter: view.presentation?.showCampusFilter ?? true,
                              }
                            : {
                                campusGroupingMode: undefined,
                                showCampusFilter: undefined,
                              }),
                        });
                      }}
                      className="mt-0.5 rounded border-[color:var(--wsu-border)]"
                    />
                    <span>
                      <span className="font-medium text-[color:var(--wsu-ink)]">Group into sections by program</span>
                      <span className="mt-0.5 block text-xs text-[color:var(--wsu-muted)]">
                        Section headers show all campuses for that program. Requires program and campus fields above.
                      </span>
                    </span>
                  </label>

                  {view.presentation?.campusGroupingMode === "grouped" ? (
                    <label className="flex items-start gap-3 pl-0 text-sm sm:pl-7">
                      <input
                        type="checkbox"
                        checked={view.presentation?.showCampusFilter !== false}
                        onChange={(e) =>
                          update("presentation", {
                            ...view.presentation,
                            showCampusFilter: e.target.checked,
                          })
                        }
                        className="mt-0.5 rounded border-[color:var(--wsu-border)]"
                      />
                      <span>
                        <span className="font-medium text-[color:var(--wsu-ink)]">Show campus filter chips</span>
                        <span className="mt-0.5 block text-xs text-[color:var(--wsu-muted)]">
                          Only when two or more campuses exist in data. “All” clears the filter.
                        </span>
                      </span>
                    </label>
                  ) : null}

                  <fieldset className="space-y-3 border-t border-[color:var(--wsu-border)] pt-4">
                    <legend className="text-sm font-medium text-[color:var(--wsu-ink)]">Merge duplicate sheet rows</legend>
                    <p className="text-xs text-[color:var(--wsu-muted)]">
                      Requires program and campus fields above. Choose one strategy — email merge is best when the same person appears on multiple
                      campus lines; campus merge is best when the same program+campus picklist appears on more than one sheet row. Design for
                      identical contacts and matching non-campus data across lines that merge; the app unions campuses and shows each other field once
                      on the card and in the contributor editor (repeated slots in custom card layout collapse after merge).
                    </p>
                    {(() => {
                      const peopleKeysAll = view.fields.filter((f) => f.render.type === "people_group").map((f) => f.key);
                      const mergeMode =
                        view.presentation?.mergeProgramRowsByProgramAndCampus === true
                          ? "campus"
                          : view.presentation?.mergeProgramRowsBySharedEmail === true
                            ? "email"
                            : "off";
                      const setMergeMode = (mode: "off" | "email" | "campus") => {
                        if (mode === "off") {
                          update("presentation", {
                            ...view.presentation,
                            mergeProgramRowsBySharedEmail: undefined,
                            mergeProgramRowsByProgramAndCampus: undefined,
                            mergePeopleFieldKey: undefined,
                            mergePeopleFieldKeys: undefined,
                          });
                        } else if (mode === "email") {
                          update("presentation", {
                            ...view.presentation,
                            mergeProgramRowsBySharedEmail: true,
                            mergeProgramRowsByProgramAndCampus: undefined,
                            ...(peopleKeysAll.length > 0
                              ? { mergePeopleFieldKey: undefined, mergePeopleFieldKeys: peopleKeysAll }
                              : { mergePeopleFieldKey: undefined, mergePeopleFieldKeys: undefined }),
                          });
                        } else {
                          update("presentation", {
                            ...view.presentation,
                            mergeProgramRowsBySharedEmail: undefined,
                            mergeProgramRowsByProgramAndCampus: true,
                            mergePeopleFieldKey: undefined,
                            mergePeopleFieldKeys: undefined,
                          });
                        }
                      };
                      return (
                        <div className="flex flex-col gap-3">
                          <label className="flex items-start gap-3 text-sm">
                            <input
                              type="radio"
                              name="merge-program-rows-mode"
                              checked={mergeMode === "off"}
                              onChange={() => setMergeMode("off")}
                              className="mt-1 border-[color:var(--wsu-border)]"
                            />
                            <span>
                              <span className="font-medium text-[color:var(--wsu-ink)]">Off</span>
                              <span className="mt-0.5 block text-xs text-[color:var(--wsu-muted)]">
                                One public row per Smartsheet row.
                              </span>
                            </span>
                          </label>
                          <label className="flex items-start gap-3 text-sm">
                            <input
                              type="radio"
                              name="merge-program-rows-mode"
                              checked={mergeMode === "email"}
                              onChange={() => setMergeMode("email")}
                              className="mt-1 border-[color:var(--wsu-border)]"
                            />
                            <span>
                              <span className="font-medium text-[color:var(--wsu-ink)]">Same program + same contact email(s)</span>
                              <span className="mt-0.5 block text-xs text-[color:var(--wsu-muted)]">
                                Rows that share the same program and the same email address(es) on the selected people fields become one
                                listing. Campus values are unioned. Only use when the same coordinator (or other contacts) and the same program
                                metadata apply on each line—Smartsheet rows should match except campus. Rows with no email on those fields are not merged with others.
                              </span>
                            </span>
                          </label>
                          <label className="flex items-start gap-3 text-sm">
                            <input
                              type="radio"
                              name="merge-program-rows-mode"
                              checked={mergeMode === "campus"}
                              onChange={() => setMergeMode("campus")}
                              className="mt-1 border-[color:var(--wsu-border)]"
                            />
                            <span>
                              <span className="font-medium text-[color:var(--wsu-ink)]">Same program + same campus (picklist)</span>
                              <span className="mt-0.5 block text-xs text-[color:var(--wsu-muted)]">
                                Rows that share the same program name and the same campus field value (after campus normalization) merge
                                into one row. First row wins for contact and other fields; blank campus never merges. Use when duplicates
                                differ by sheet line only, not by campus label.
                              </span>
                            </span>
                          </label>
                        </div>
                      );
                    })()}
                  </fieldset>

                  {view.presentation?.mergeProgramRowsBySharedEmail === true &&
                  view.fields.filter((f) => f.render.type === "people_group").length > 0 ? (
                    <div className="space-y-2 pl-0 sm:pl-7">
                      <p className="text-xs font-medium text-[color:var(--wsu-muted)]">People fields for email matching</p>
                      <p className="text-[10px] text-[color:var(--wsu-muted)]">
                        Select one or more role / people fields. Merge compares the sorted, deduped set of emails across all of them.
                      </p>
                      <div className="flex flex-col gap-2">
                        {view.fields
                          .filter((f) => f.render.type === "people_group")
                          .map((f) => {
                            const selected = new Set(
                              (view.presentation?.mergePeopleFieldKeys?.length
                                ? view.presentation.mergePeopleFieldKeys
                                : view.presentation?.mergePeopleFieldKey
                                  ? [view.presentation.mergePeopleFieldKey]
                                  : view.fields.filter((ff) => ff.render.type === "people_group").length === 1
                                    ? [view.fields.find((ff) => ff.render.type === "people_group")!.key]
                                    : []) as string[],
                            );
                            const checked = selected.has(f.key);
                            return (
                              <label key={f.key} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    const next = new Set(selected);
                                    if (next.has(f.key)) {
                                      next.delete(f.key);
                                    } else {
                                      next.add(f.key);
                                    }
                                    const arr = [...next];
                                    update("presentation", {
                                      ...view.presentation,
                                      mergePeopleFieldKeys: arr.length > 0 ? arr : undefined,
                                      mergePeopleFieldKey: undefined,
                                    });
                                  }}
                                  className="rounded border-[color:var(--wsu-border)]"
                                />
                                <span>{f.label || f.key}</span>
                              </label>
                            );
                          })}
                      </div>
                    </div>
                  ) : null}

                  {view.presentation?.campusFieldKey ? (
                    <div className="space-y-3 border-t border-[color:var(--wsu-border)] pt-4">
                      <label className="flex items-start gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={view.presentation?.hideCampusFieldInRecordDisplay === true}
                          onChange={(e) =>
                            update("presentation", {
                              ...view.presentation,
                              hideCampusFieldInRecordDisplay: e.target.checked ? true : undefined,
                            })
                          }
                          className="mt-0.5 rounded border-[color:var(--wsu-border)]"
                        />
                        <span>
                          <span className="font-medium text-[color:var(--wsu-ink)]">Hide campus column from records</span>
                          <span className="mt-0.5 block text-xs text-[color:var(--wsu-muted)]">
                            Campus still loads for grouping, merge, and filters. The campus field is omitted from default field lists and
                            from custom card slots that use the campus field key — add{" "}
                            <code className="rounded bg-black/[0.04] px-1 py-0.5 text-[10px]">{CARD_LAYOUT_CAMPUS_BADGES}</code> in Custom
                            card layout if you want a badge strip there.
                          </span>
                        </span>
                      </label>
                      {view.presentation?.campusGroupingMode === "grouped" ? (
                        <div className="space-y-3 rounded-xl border border-[color:var(--wsu-border)]/80 bg-[color:var(--wsu-stone)]/15 px-3 py-3 sm:px-4">
                          <p className="text-xs font-semibold text-[color:var(--wsu-ink)]">Program section header (live view)</p>
                          <p className="text-[10px] leading-snug text-[color:var(--wsu-muted)]">
                            Shown only when <strong className="text-[color:var(--wsu-ink)]">Group into sections by program</strong> is on.
                            Turn both off below if you want cards in a group listed back‑to‑back with no grey title bar.
                          </p>
                          <label className="flex items-start gap-3 text-sm">
                            <input
                              type="checkbox"
                              checked={view.presentation?.showProgramSectionHeaders !== false}
                              onChange={(e) =>
                                update("presentation", {
                                  ...view.presentation,
                                  showProgramSectionHeaders: e.target.checked ? true : false,
                                })
                              }
                              className="mt-0.5 rounded border-[color:var(--wsu-border)]"
                            />
                            <span>
                              <span className="font-medium text-[color:var(--wsu-ink)]">Show program name title band</span>
                              <span className="mt-0.5 block text-xs text-[color:var(--wsu-muted)]">
                                The grey bar with the program name above each group of cards or rows. Off = no bar; cards stack with normal
                                spacing only.
                              </span>
                            </span>
                          </label>
                          <label className="flex items-start gap-3 text-sm">
                            <input
                              type="checkbox"
                              checked={view.presentation?.showCampusStripOnProgramSections !== false}
                              onChange={(e) =>
                                update("presentation", {
                                  ...view.presentation,
                                  showCampusStripOnProgramSections: e.target.checked ? true : false,
                                })
                              }
                              className="mt-0.5 rounded border-[color:var(--wsu-border)]"
                            />
                            <span>
                              <span className="font-medium text-[color:var(--wsu-ink)]">Show campus chips under program title</span>
                              <span className="mt-0.5 block text-xs text-[color:var(--wsu-muted)]">
                                Campus pills below the program name on that bar (union of campuses for that program). Turn off if you only want
                                campuses on each card or in custom layout (<code className="rounded bg-black/[0.04] px-1 py-0.5 text-[10px]">{CARD_LAYOUT_CAMPUS_BADGES}</code>
                                ). Chip styling: <strong>Appearance &amp; theme</strong> → theme designer → <strong>Chips</strong>.
                              </span>
                            </span>
                          </label>
                        </div>
                      ) : null}
                      <label className="flex items-start gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={view.presentation?.showMergedCampusBadgesOnRecords !== false}
                          onChange={(e) =>
                            update("presentation", {
                              ...view.presentation,
                              showMergedCampusBadgesOnRecords: e.target.checked ? true : false,
                            })
                          }
                          className="mt-0.5 rounded border-[color:var(--wsu-border)]"
                        />
                        <span>
                          <span className="font-medium text-[color:var(--wsu-ink)]">Show automatic merged-row campus badges</span>
                          <span className="mt-0.5 block text-xs text-[color:var(--wsu-muted)]">
                            When off, merged rows only show campus chips if you add the{" "}
                            <code className="rounded bg-black/[0.04] px-1 py-0.5 text-[10px]">{CARD_LAYOUT_CAMPUS_BADGES}</code> row in
                            custom layout.
                          </span>
                        </span>
                      </label>
                    </div>
                  ) : null}

                  <p className="text-xs leading-relaxed text-[color:var(--wsu-muted)]">
                    With <strong className="text-[color:var(--wsu-ink)]">Group into sections by program</strong>, the{" "}
                    <strong className="text-[color:var(--wsu-ink)]">Program section header</strong> box controls the title band and campus chips.
                    Email-merge can union several campuses; turn off the title band or chips there if you prefer chips only on each card
                    (and keep <strong className="text-[color:var(--wsu-ink)]">Show automatic merged-row campus badges</strong> on).
                  </p>
                </>
              )}
            </div>
          </SetupAccordion>

          <SetupAccordion
            title="Page header & branding"
            subtitle="Logo, custom text, and which lines appear in the public masthead."
          >
            <div className="space-y-8">
              <VisibilitySelect
                label="Page header"
                value={!view.presentation?.hideHeader}
                onChange={(show) => update("presentation", { ...view.presentation, hideHeader: !show })}
                description="The top card with custom text and status. Hide when neither is needed."
              />
              {/* Custom Content */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[color:var(--wsu-ink)]">Custom header text</span>
                  <label className="flex items-center gap-2 text-xs font-medium text-[color:var(--wsu-muted)] cursor-pointer hover:text-[color:var(--wsu-crimson)]">
                    <input 
                      type="checkbox" 
                      checked={view.presentation?.headerCustomText !== undefined} 
                      onChange={(e) => {
                        if (!e.target.checked) {
                          update("presentation", { ...view.presentation, headerCustomText: undefined });
                        } else {
                          update("presentation", { ...view.presentation, headerCustomText: "" });
                        }
                      }}
                      className="rounded border-[color:var(--wsu-border)]"
                    />
                    Enable custom text
                  </label>
                </div>
                {view.presentation?.headerCustomText !== undefined && (
                  <HeaderCustomTextEditor
                    value={view.presentation?.headerCustomText ?? ""}
                    onChange={(v) => update("presentation", { ...view.presentation, headerCustomText: v || undefined })}
                    placeholder="Enter branding, instructions, or extra links..."
                  />
                )}
              </div>

              <HeaderLogoBrandingSection
                viewLabel={view.label}
                presentation={view.presentation}
                onPresentationChange={(next) => update("presentation", next)}
              />

              <div className="grid gap-8 md:grid-cols-2">
                {/* Visibility Toggles */}
                <div className="space-y-4">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[color:var(--wsu-muted)]">Header Elements</span>
                  <div className="space-y-3">
                    <VisibilitySelect
                      label="Back link"
                      value={!view.presentation?.hideHeaderBackLink}
                      onChange={(show) => update("presentation", { ...view.presentation, hideHeaderBackLink: !show })}
                    />
                    <VisibilitySelect
                      label="Source label"
                      value={!view.presentation?.hideHeaderSourceLabel}
                      onChange={(show) => update("presentation", { ...view.presentation, hideHeaderSourceLabel: !show })}
                    />
                    <VisibilitySelect
                      label="Page title"
                      value={!view.presentation?.hideHeaderPageTitle}
                      onChange={(show) => update("presentation", { ...view.presentation, hideHeaderPageTitle: !show })}
                    />
                    <VisibilitySelect
                      label="Live data text"
                      value={!view.presentation?.hideHeaderLiveDataText}
                      onChange={(show) => update("presentation", { ...view.presentation, hideHeaderLiveDataText: !show })}
                    />
                  </div>
                </div>

                {/* Info Box Toggles */}
                <div className="space-y-4">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[color:var(--wsu-muted)]">Status/Info Box</span>
                  <div className="space-y-3">
                    <VisibilitySelect
                      label="Status Box"
                      value={!view.presentation?.hideHeaderInfoBox}
                      onChange={(show) => update("presentation", { ...view.presentation, hideHeaderInfoBox: !show })}
                      description="Shows active view, row count, and refresh time."
                    />
                    
                    {!view.presentation?.hideHeaderInfoBox && (
                      <div className="ml-4 space-y-3 border-l-2 border-[color:var(--wsu-border)] pl-4 animate-in fade-in slide-in-from-left-2 duration-200">
                        <VisibilitySelect
                          label="Active view name"
                          value={!view.presentation?.hideHeaderActiveView}
                          onChange={(show) => update("presentation", { ...view.presentation, hideHeaderActiveView: !show })}
                        />
                        <VisibilitySelect
                          label="Row count"
                          value={!view.presentation?.hideHeaderRows}
                          onChange={(show) => update("presentation", { ...view.presentation, hideHeaderRows: !show })}
                        />
                        <VisibilitySelect
                          label="Refresh time"
                          value={!view.presentation?.hideHeaderRefreshed}
                          onChange={(show) => update("presentation", { ...view.presentation, hideHeaderRefreshed: !show })}
                        />
                        {view.editing?.enabled && (
                          <>
                            <VisibilitySelect
                              label="Contributor sign in"
                              value={view.editing.showLoginLink !== false}
                              onChange={(show) =>
                                update("editing", {
                                  ...createEditingConfigState(view.editing),
                                  enabled: true,
                                  showLoginLink: show,
                                })
                              }
                              description="Shows login link in status box. Same setting as Editing tab."
                            />
                            <VisibilitySelect
                              label="Contributor instructions link"
                              value={view.editing.showContributorInstructions !== false}
                              onChange={(show) =>
                                update("editing", {
                                  ...createEditingConfigState(view.editing),
                                  enabled: true,
                                  showContributorInstructions: show,
                                })
                              }
                              description="Shows a link that opens the contributor help page in a new tab (no login to read it). Same setting as Editing tab."
                            />
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </SetupAccordion>

          <SetupAccordion
            title="Content area (below header)"
            subtitle="View title, shared slug tabs, and layout switcher above the data."
          >
            <div className="space-y-6">
              <VisibilitySelect
                label="View title section"
                value={!view.presentation?.hideViewTitleSection}
                onChange={(show) => update("presentation", { ...view.presentation, hideViewTitleSection: !show })}
                description="The h2 title and optional description below the tabs."
              />

              <div className="space-y-4 rounded-xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/10 p-4">
                <VisibilitySelect
                  label="View tabs"
                  value={!view.presentation?.hideViewTabs}
                  onChange={(show) => update("presentation", { ...view.presentation, hideViewTabs: !show })}
                  description="Navigation tabs when multiple views share a slug."
                />
                
                {!view.presentation?.hideViewTabs && (
                  <div className="ml-4 space-y-4 border-l-2 border-[color:var(--wsu-border)] pl-4 animate-in fade-in slide-in-from-left-2 duration-200">
                    <VisibilitySelect
                      label="Row count on tabs"
                      value={!view.presentation?.hideViewTabCount}
                      onChange={(show) => update("presentation", { ...view.presentation, hideViewTabCount: !show })}
                    />
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-[color:var(--wsu-ink)]">Custom tab label</span>
                      <input 
                        type="text" 
                        value={view.presentation?.viewTabLabel ?? ""} 
                        onChange={(e) => update("presentation", { ...view.presentation, viewTabLabel: e.target.value || undefined })} 
                        placeholder={view.label} 
                        className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm" 
                      />
                      <p className="text-[10px] text-[color:var(--wsu-muted)]">Overrides the view label on the tab.</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <VisibilitySelect
                  label="Layout switcher"
                  value={!view.fixedLayout}
                  onChange={(show) => update("fixedLayout", !show)}
                  description="Allow viewers to switch between table, cards, and list views."
                />
              </div>

              <div className="space-y-2 rounded-xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/10 p-4">
                <label className="block text-sm font-medium text-[color:var(--wsu-ink)]" htmlFor="view-display-tz">
                  Display time zone for dates
                </label>
                <select
                  id="view-display-tz"
                  value={effectiveViewDisplayTimeZone(view)}
                  onChange={(e) => update("displayTimeZone", e.target.value)}
                  className="mt-1 w-full max-w-md rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm text-[color:var(--wsu-ink)]"
                >
                  {DISPLAY_TIMEZONE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[color:var(--wsu-muted)]">
                  Public pages show this as a note next to search; date and datetime fields use it for display. Visitors
                  cannot change it.
                </p>
              </div>
            </div>
          </SetupAccordion>

          <SetupAccordion title="Appearance & theme" subtitle="Choose a preset, then tune colors, type, shapes, and masthead in the tabs below.">
          <ThemeEditor view={view} update={update} />
          </SetupAccordion>

          <SetupAccordion title="Publication & URLs" subtitle="Draft vs published, links, and embed snippet.">
            <div className="space-y-4">
            <div className="rounded-xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/10 px-4 py-4 text-sm text-[color:var(--wsu-muted)]">
              <p><span className="font-semibold text-[color:var(--wsu-ink)]">Publication state:</span> {view.public ? "Published" : "Draft"}</p>
              <p className="mt-2">Publication is controlled only by the Publish button so schema validation always runs before a view goes live.</p>
            </div>

            {!isNew && (
              <div>
                <button
                  type="button"
                  onClick={() => void duplicateView()}
                  className="rounded-full border border-[color:var(--wsu-border)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--wsu-muted)] hover:border-[color:var(--wsu-crimson)] hover:text-[color:var(--wsu-crimson)]"
                >
                  Duplicate view
                </button>
              </div>
            )}

            <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-4 text-sm text-[color:var(--wsu-muted)]">
              <p className="font-semibold text-[color:var(--wsu-ink)]">Publish outputs</p>
              <p className="mt-2"><span className="font-medium">Preview:</span> {previewHref ?? "Save the view to enable preview."}</p>
              <p className="mt-1">
                <span className="font-medium">Public URL:</span>{" "}
                {view.public ? (
                  <a
                    href={`${typeof window !== "undefined" ? window.location.origin : ""}${publicInteractiveHref(view.slug, view.id, singlePublishedOnSlug)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[color:var(--wsu-crimson)] underline hover:text-[color:var(--wsu-crimson-dark)]"
                  >
                    {typeof window !== "undefined" ? window.location.origin : ""}
                    {publicInteractiveHref(view.slug, view.id, singlePublishedOnSlug)}
                  </a>
                ) : (
                  "Not published."
                )}
              </p>
              <p className="mt-3 font-medium text-[color:var(--wsu-ink)]">WordPress embed</p>
              <textarea
                readOnly
                rows={3}
                value={
                  view.public
                    ? `<iframe src="${typeof window !== "undefined" ? window.location.origin : ""}${publicInteractiveHref(view.slug, view.id, singlePublishedOnSlug, { embed: true })}" style="width:100%;border:0;min-height:640px;" loading="lazy"></iframe>`
                    : "Publish the view to generate an embed snippet."
                }
                className="mt-2 w-full rounded-xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/30 px-3 py-2 font-mono text-xs text-[color:var(--wsu-ink)]"
              />
            </div>
            </div>
          </SetupAccordion>

            {view.sourceId && view.fields.length > 0 && (
              <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-4">
                <ViewBuilderLivePreview
                  subtitle="Updates as you edit (1s delay)"
                  view={view}
                  sourceMap={sourceMap}
                  livePreview={livePreview}
                  livePreviewLoading={livePreviewLoading}
                  livePreviewError={livePreviewError}
                  showEmptyAndErrorStates
                />
              </div>
            )}
    </div>
  );
}
