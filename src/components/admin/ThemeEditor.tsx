import React, { useMemo, useState } from "react";
import { useConfirmDialog } from "@/components/ui/ConfirmModal";
import {
  BORDER_RADIUS_OPTIONS,
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  FONT_STYLE_OPTIONS,
  FONT_WEIGHT_OPTIONS,
  HEADER_TOP_BORDER_WIDTH_OPTIONS,
  LETTER_SPACING_OPTIONS,
  SHADOW_OPTIONS,
  TEXT_TRANSFORM_OPTIONS,
} from "@/lib/config/options";
import { BUILT_IN_THEMES, mergeThemeTokens } from "@/lib/config/themes";
import type { CampusBadgePresentationStyle, ViewConfig, ViewStyleConfig } from "@/lib/config/types";
import { getContrastRatio, getContrastScore } from "@/lib/color-utils";

interface ThemeEditorProps {
  view: ViewConfig;
  update: <K extends keyof ViewConfig>(key: K, value: ViewConfig[K]) => void;
}

const COLOR_LABELS: Record<string, string> = {
  backgroundColor: "Page background",
  cardBackground: "Card/panel background",
  surfaceMutedBackground: "Muted surface background",
  accentColor: "Accent (buttons, controls)",
  valueLinkColor: "Value link color (email, phone, URL)",
  textColor: "Primary text (body & values)",
  headingTextColor: "Heading text (card titles, section headings)",
  mutedColor: "Secondary/label text",
  borderColor: "Borders",
  controlBackground: "Control background",
  controlText: "Control text",
  controlBorder: "Control border",
  controlHoverBackground: "Control hover background",
  controlActiveBackground: "Active control background",
  controlActiveText: "Active control text",
  badgeBg: "Badge background (Smartsheet “badge” columns only)",
  badgeText: "Badge text (Smartsheet “badge” columns only)",
  peopleCampusChipBg:
    "People campus chip background (beside names). Override: Setup → Theme → Chips sets inline colors that win over these palette values.",
  peopleCampusChipText: "People campus chip text (beside names)",
  peopleCampusChipBorder: "People campus chip border (beside names)",
};

const COLOR_TOKENS = Object.keys(COLOR_LABELS) as Array<keyof ViewStyleConfig>;

const HEADER_COLOR_LABELS: Partial<Record<keyof ViewStyleConfig, string>> = {
  headerTopBorderColor: "Brand strip top rule",
  headerPanelBackgroundColor: "Masthead card background",
  headerPanelBorderColor: "Masthead card border",
  headerBrandSublineColor: "Brand subline (small line)",
  headerBrandTitleColor: "Brand title (large line)",
  headerSourceLabelColor: "Source label (upper line above page title)",
  headerPageTitleColor: "Page title (main h1 in header)",
  headerLiveBlurbColor: "“Live data from…” text",
  headerLiveBlurbStrongColor: "“Live data…” source name emphasis",
};
const HEADER_COLOR_TOKENS = Object.keys(HEADER_COLOR_LABELS) as Array<keyof ViewStyleConfig>;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold uppercase tracking-widest text-[color:var(--wsu-muted)]">{title}</h4>
      {children}
    </div>
  );
}

type DesignTabId = "palette" | "typography" | "chips" | "effects" | "header";

export function ThemeEditor({ view, update }: ThemeEditorProps) {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [isExpanded, setIsExpanded] = useState(false);
  const [designTab, setDesignTab] = useState<DesignTabId>("palette");
  const currentPresetId = view.themePresetId ?? "wsu_crimson";
  const currentPreset = BUILT_IN_THEMES.find((t) => t.id === currentPresetId) ?? BUILT_IN_THEMES[0];
  const hasOverrides = view.style && Object.keys(view.style).length > 0;
  const mergedPreview = useMemo(
    () => mergeThemeTokens(currentPresetId, view.style),
    [currentPresetId, view.style],
  );

  const handlePresetSelect = (themeId: string) => {
    if (hasOverrides && themeId !== currentPresetId) {
      void confirm({
        title: "Switch preset",
        message: "Switching presets will reset your custom overrides. Continue?",
        confirmLabel: "Continue",
      }).then((confirmed) => {
        if (!confirmed) return;
        update("themePresetId", themeId);
        update("style", undefined);
      });
      return;
    }
    update("themePresetId", themeId);
    update("style", undefined);
  };

  const updateStyle = (token: keyof ViewStyleConfig, value: string) => {
    const nextStyle = { ...view.style };
    if (value === "" || value === (currentPreset.tokens[token] as string)) {
      delete (nextStyle as Record<string, unknown>)[token];
    } else {
      (nextStyle as Record<string, string>)[token] = value;
    }
    update("style", Object.keys(nextStyle).length > 0 ? nextStyle : undefined);
  };

  const patchCampusBadgeStyle = (key: keyof CampusBadgePresentationStyle, raw: string) => {
    const v = raw.trim();
    const nextStyle = { ...(view.presentation?.campusBadgeStyle ?? {}) } as Record<
      keyof CampusBadgePresentationStyle,
      string | undefined
    >;
    if (!v) {
      delete nextStyle[key];
    } else {
      nextStyle[key] = v;
    }
    const compact = Object.fromEntries(
      Object.entries(nextStyle).filter(([, val]) => Boolean(val && String(val).trim())),
    ) as CampusBadgePresentationStyle;
    update("presentation", {
      ...view.presentation,
      campusBadgeStyle: Object.keys(compact).length > 0 ? compact : undefined,
    });
  };

  const getCampusBadge = (key: keyof CampusBadgePresentationStyle) =>
    String((view.presentation?.campusBadgeStyle as Record<string, string> | undefined)?.[key] ?? "");

  const campusFontSize = getCampusBadge("fontSize");
  const campusFontSizeSelectOptions = useMemo(() => {
    const base = [{ value: "", label: "Default (small chip)" }, ...FONT_SIZE_OPTIONS];
    if (campusFontSize && !base.some((o) => o.value === campusFontSize)) {
      return [{ value: campusFontSize, label: `${campusFontSize} (custom)` }, ...base];
    }
    return base;
  }, [campusFontSize]);

  const campusBorderRadius = getCampusBadge("borderRadius");
  const campusRadiusSelectOptions = useMemo(() => {
    const base = [
      { value: "", label: "Default (pill shape)" },
      ...BORDER_RADIUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
      { value: "9999px", label: "Full capsule" },
    ];
    if (campusBorderRadius && !base.some((o) => o.value === campusBorderRadius)) {
      return [{ value: campusBorderRadius, label: `${campusBorderRadius} (custom)` }, ...base];
    }
    return base;
  }, [campusBorderRadius]);

  const campusFontWeight = getCampusBadge("fontWeight");
  const campusFontWeightSelectOptions = useMemo(() => {
    const base = [{ value: "", label: "Default" }, ...FONT_WEIGHT_OPTIONS];
    if (campusFontWeight && !base.some((o) => o.value === campusFontWeight)) {
      return [{ value: campusFontWeight, label: `${campusFontWeight} (custom)` }, ...base];
    }
    return base;
  }, [campusFontWeight]);

  const campusFontFamily = getCampusBadge("fontFamily");
  const campusFontFamilySelectOptions = useMemo(() => {
    const base = [{ value: "", label: "Default (inherit page)" }, ...FONT_OPTIONS];
    if (campusFontFamily && !base.some((o) => o.value === campusFontFamily)) {
      return [{ value: campusFontFamily, label: `${campusFontFamily} (custom)` }, ...base];
    }
    return base;
  }, [campusFontFamily]);

  const getValue = (token: keyof ViewStyleConfig) =>
    view.style?.[token] ?? (currentPreset.tokens[token] as string) ?? "";

  const getFontWeightValue = (token: "fontWeight" | "headingFontWeight") => {
    const v = getValue(token);
    if (v === "normal") return "400";
    if (v === "bold") return "700";
    return v || "400";
  };

  const getNumericFontWeightValue = (
    token:
      | "fontWeight"
      | "headingFontWeight"
      | "fieldLabelFontWeight"
      | "rowHeadingFontWeight"
      | "peopleNameFontWeight"
      | "peopleDetailFontWeight"
      | "headerBrandSublineFontWeight"
      | "headerBrandTitleFontWeight"
      | "headerSourceLabelFontWeight"
      | "headerPageTitleFontWeight",
  ) => {
    const v = getValue(token);
    if (v === "normal") return "400";
    if (v === "bold") return "700";
    return v || "400";
  };

  const renderContrastIndicator = (token: keyof ViewStyleConfig, value: string) => {
    if (token !== "accentColor" && token !== "textColor" && token !== "headingTextColor") return null;
    const bgToken: keyof ViewStyleConfig =
      token === "accentColor" ? "backgroundColor" : "cardBackground";
    const bgColor = getValue(bgToken) || "#ffffff";
    const fgColor = value || "#000000";
    const ratio = getContrastRatio(fgColor, bgColor);
    const score = getContrastScore(ratio);
    return (
      <p className={`mt-1 text-[10px] font-medium uppercase tracking-wider ${
        score === "pass" ? "text-emerald-600" : score === "warn" ? "text-amber-600" : "text-rose-600"
      }`}>
        Contrast: {ratio.toFixed(2)}:1 ({score})
      </p>
    );
  };

  return (
    <div className="space-y-4">
      {confirmDialog}
      <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/15 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--wsu-muted)]">Base theme</p>
        <p className="mt-1 text-sm text-[color:var(--wsu-ink)]">Pick a starting palette and page chrome. Fine-tune in the designer below.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {BUILT_IN_THEMES.map((theme) => {
            const isActive = currentPresetId === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => handlePresetSelect(theme.id)}
                className={`relative flex min-h-[76px] flex-col rounded-xl border-2 px-4 pb-3 pt-3 text-left transition ${
                  isActive
                    ? "border-[color:var(--wsu-crimson)] bg-white shadow-md ring-2 ring-[color:var(--wsu-crimson)]/15"
                    : "border-[color:var(--wsu-border)] bg-white hover:border-[color:var(--wsu-crimson)]/40"
                }`}
              >
                <div
                  className="mb-3 h-2 w-full shrink-0 rounded-md shadow-inner"
                  style={{
                    background: `linear-gradient(90deg, ${theme.tokens.accentColor ?? "#999"} 0%, ${theme.tokens.backgroundColor ?? "#eee"} 45%, ${theme.tokens.cardBackground ?? "#fff"} 100%)`,
                  }}
                />
                <span className="text-sm font-semibold text-[color:var(--wsu-ink)]">{theme.label}</span>
                <span className="mt-1 text-[10px] text-[color:var(--wsu-muted)]">{isActive ? "Active" : "Apply"}</span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-[color:var(--wsu-border)] bg-white px-4 py-3 text-left shadow-sm transition hover:border-[color:var(--wsu-crimson)]"
      >
        <span className="text-sm font-semibold text-[color:var(--wsu-ink)]">
          {isExpanded ? "Close theme designer" : "Open theme designer"}
        </span>
        <span className="flex items-center gap-2">
          {hasOverrides && (
            <span className="rounded-full bg-[color:var(--wsu-crimson)] px-2 py-0.5 text-[10px] font-medium text-white">
              {Object.keys(view.style || {}).length} override{Object.keys(view.style || {}).length === 1 ? "" : "s"}
            </span>
          )}
          <span className="text-[color:var(--wsu-muted)]" aria-hidden>
            {isExpanded ? "▴" : "▾"}
          </span>
        </span>
      </button>

      {isExpanded && (
        <div className="space-y-5 rounded-2xl border border-[color:var(--wsu-border)] bg-gradient-to-b from-[color:var(--wsu-stone)]/25 to-white p-5 shadow-sm">
          <div
            className="overflow-hidden rounded-xl border shadow-sm"
            style={{
              borderColor: mergedPreview.borderColor ?? "#e5e7eb",
              backgroundColor: mergedPreview.backgroundColor ?? "#fff",
              color: mergedPreview.textColor ?? "#111",
              fontFamily: mergedPreview.fontFamily,
            }}
          >
            <div
              className="border-b px-4 py-3"
              style={{
                borderColor: mergedPreview.borderColor ?? "#e5e7eb",
                backgroundColor: mergedPreview.cardBackground ?? "#fff",
              }}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: mergedPreview.accentColor ?? mergedPreview.primaryColor }}
              >
                Source label
              </p>
              <p
                className="mt-1 leading-tight"
                style={{
                  fontFamily: mergedPreview.headingFontFamily,
                  fontSize: mergedPreview.pageTitleFontSize ?? "1.5rem",
                  fontWeight: mergedPreview.headingFontWeight ?? 600,
                  color: mergedPreview.headingTextColor ?? mergedPreview.textColor ?? "#111",
                }}
              >
                Page title preview
              </p>
              <p className="mt-2 max-w-prose text-sm leading-relaxed" style={{ color: mergedPreview.mutedColor, fontSize: mergedPreview.fontSize }}>
                Body text and grid values follow this style. Links use the accent color.
              </p>
              <p className="mt-2 text-sm font-medium underline decoration-2 underline-offset-2" style={{ color: mergedPreview.accentColor ?? mergedPreview.primaryColor }}>
                Sample accent link
              </p>
            </div>
            <p className="bg-black/[0.03] px-3 py-1.5 text-[10px] text-[color:var(--wsu-muted)]">Merged preview (preset + your overrides)</p>
          </div>

          <div className="flex flex-wrap gap-1 rounded-xl bg-[color:var(--wsu-border)]/20 p-1">
            {(
              [
                { id: "palette" as const, label: "Palette" },
                { id: "typography" as const, label: "Typography" },
                { id: "chips" as const, label: "Chips" },
                { id: "effects" as const, label: "Cards & radius" },
                { id: "header" as const, label: "Masthead" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDesignTab(tab.id)}
                className={`min-h-[40px] flex-1 rounded-lg px-2 py-2 text-xs font-semibold sm:px-3 sm:text-sm ${
                  designTab === tab.id
                    ? "bg-white text-[color:var(--wsu-ink)] shadow-sm"
                    : "text-[color:var(--wsu-muted)] hover:text-[color:var(--wsu-ink)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {designTab === "palette" && (
            <Section title="Palette & surfaces">
              <div className="space-y-4">
                {COLOR_TOKENS.map((token) => (
                  <div key={token}>
                    <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">
                      {COLOR_LABELS[token]}
                    </label>
                    <div className="flex gap-2">
                      <div className="relative h-9 w-12 shrink-0 overflow-hidden rounded-lg border border-[color:var(--wsu-border)]">
                        <input
                          type="color"
                          value={(getValue(token) || "").match(/#[0-9A-Fa-f]{3,6}/)?.[0] ?? "#ffffff"}
                          onChange={(e) => updateStyle(token, e.target.value)}
                          className="absolute inset-[-4px] h-[calc(100%+8px)] w-[calc(100%+8px)] cursor-pointer"
                        />
                      </div>
                      <div className="relative min-w-0 flex-1">
                        <input
                          type="text"
                          value={view.style?.[token] ?? ""}
                          onChange={(e) => updateStyle(token, e.target.value)}
                          placeholder={currentPreset.tokens[token] as string}
                          className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-2.5 py-1.5 font-mono text-xs"
                        />
                        {view.style?.[token] && (
                          <button
                            type="button"
                            onClick={() => updateStyle(token, "")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[color:var(--wsu-muted)] hover:text-rose-600"
                            title="Reset to preset"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                    {renderContrastIndicator(token, getValue(token))}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {designTab === "typography" && (
            <Section title="Typography">
              <div className="space-y-5">

                {/* ── Families ── */}
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[color:var(--wsu-border)]">Families</p>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Body font</label>
                      <select value={getValue("fontFamily")} onChange={(e) => updateStyle("fontFamily", e.target.value)} className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm">
                        {FONT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                      <p className="mt-0.5 text-[10px] text-[color:var(--wsu-muted)]">All body text, cell values, descriptions</p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Heading font</label>
                      <select value={getValue("headingFontFamily")} onChange={(e) => updateStyle("headingFontFamily", e.target.value)} className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm">
                        {FONT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                      <p className="mt-0.5 text-[10px] text-[color:var(--wsu-muted)]">Page title, section title, row headings, field labels (masthead has its own controls)</p>
                    </div>
                  </div>
                </div>

                {/* ── Sizes ── */}
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[color:var(--wsu-border)]">Sizes</p>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Body size</label>
                      <select value={getValue("fontSize")} onChange={(e) => updateStyle("fontSize", e.target.value)} className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm">
                        {FONT_SIZE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                      <p className="mt-0.5 text-[10px] text-[color:var(--wsu-muted)]">All body text and cell values</p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Page title size</label>
                      <select value={getValue("pageTitleFontSize")} onChange={(e) => updateStyle("pageTitleFontSize", e.target.value)} className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm">
                        {FONT_SIZE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                      <p className="mt-0.5 text-[10px] text-[color:var(--wsu-muted)]">
                        Main page h1 (e.g.&nbsp;&ldquo;Graduate Program Contact List&rdquo;)
                      </p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Section title size</label>
                      <select value={getValue("headingFontSize")} onChange={(e) => updateStyle("headingFontSize", e.target.value)} className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm">
                        {FONT_SIZE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                      <p className="mt-0.5 text-[10px] text-[color:var(--wsu-muted)]">
                        View label h2 below tabs (e.g.&nbsp;&ldquo;Faculty&rdquo;)
                      </p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Row heading size</label>
                      <select value={getValue("rowHeadingFontSize")} onChange={(e) => updateStyle("rowHeadingFontSize", e.target.value)} className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm">
                        {FONT_SIZE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                      <p className="mt-0.5 text-[10px] text-[color:var(--wsu-muted)]">Card, list, accordion, and table row titles</p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Field label size</label>
                      <select value={getValue("fieldLabelFontSize")} onChange={(e) => updateStyle("fieldLabelFontSize", e.target.value)} className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm">
                        {FONT_SIZE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                      <p className="mt-0.5 text-[10px] text-[color:var(--wsu-muted)]">Column headers and field labels in cards/lists</p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Action button size</label>
                      <select value={getValue("actionFontSize")} onChange={(e) => updateStyle("actionFontSize", e.target.value)} className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm">
                        {FONT_SIZE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                      <p className="mt-0.5 text-[10px] text-[color:var(--wsu-muted)]">Contributor sign in, Print/PDF, layout switcher pills</p>
                    </div>
                  </div>
                </div>

                {/* ── Per-field scale (display / title / subtitle) ── */}
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[color:var(--wsu-border)]">Per-field typography scale</p>
                  <p className="mb-3 text-[10px] text-[color:var(--wsu-muted)]">
                    Used when a field sets value or label style to display, title, or subtitle. Body, label, and muted reuse global tokens above.
                  </p>
                  <div className="space-y-3">
                    {(
                      [
                        { label: "Display", size: "displayTextFontSize", weight: "displayTextFontWeight", color: "displayTextColor" },
                        { label: "Title", size: "titleTextFontSize", weight: "titleTextFontWeight", color: "titleTextColor" },
                        { label: "Subtitle", size: "subtitleTextFontSize", weight: "subtitleTextFontWeight", color: "subtitleTextColor" },
                      ] as const
                    ).map((row) => (
                      <div key={row.label} className="rounded-xl border border-[color:var(--wsu-border)]/70 bg-white/60 p-3">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[color:var(--wsu-muted)]">{row.label}</p>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <label className="block">
                            <span className="mb-1 block text-[10px] font-medium text-[color:var(--wsu-muted)]">Size</span>
                            <select
                              value={getValue(row.size)}
                              onChange={(e) => updateStyle(row.size, e.target.value)}
                              className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-2 py-1.5 text-xs"
                            >
                              {FONT_SIZE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-[10px] font-medium text-[color:var(--wsu-muted)]">Weight</span>
                            <select
                              value={getValue(row.weight) || "400"}
                              onChange={(e) => updateStyle(row.weight, e.target.value)}
                              className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-2 py-1.5 text-xs"
                            >
                              {FONT_WEIGHT_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-[10px] font-medium text-[color:var(--wsu-muted)]">Color</span>
                            <div className="flex gap-2">
                              <div className="relative h-8 w-10 shrink-0 overflow-hidden rounded-lg border border-[color:var(--wsu-border)]">
                                <input
                                  type="color"
                                  value={(getValue(row.color) || "").match(/#[0-9A-Fa-f]{3,6}/)?.[0] ?? "#111111"}
                                  onChange={(e) => updateStyle(row.color, e.target.value)}
                                  className="absolute inset-[-4px] h-[calc(100%+8px)] w-[calc(100%+8px)] cursor-pointer"
                                />
                              </div>
                              <input
                                type="text"
                                value={getValue(row.color)}
                                onChange={(e) => updateStyle(row.color, e.target.value)}
                                placeholder="#111111"
                                className="min-w-0 flex-1 rounded-lg border border-[color:var(--wsu-border)] bg-white px-2 py-1 text-xs"
                              />
                            </div>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Weights ── */}
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[color:var(--wsu-border)]">Weights</p>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Body weight</label>
                      <select value={getFontWeightValue("fontWeight")} onChange={(e) => updateStyle("fontWeight", e.target.value)} className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm">
                        {FONT_WEIGHT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                      <p className="mt-0.5 text-[10px] text-[color:var(--wsu-muted)]">All body text</p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Heading weight</label>
                      <select value={getFontWeightValue("headingFontWeight")} onChange={(e) => updateStyle("headingFontWeight", e.target.value)} className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm">
                        {FONT_WEIGHT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                      <p className="mt-0.5 text-[10px] text-[color:var(--wsu-muted)]">Section title and row headings only (page title in header uses masthead controls)</p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Row heading weight</label>
                      <select value={getNumericFontWeightValue("rowHeadingFontWeight")} onChange={(e) => updateStyle("rowHeadingFontWeight", e.target.value)} className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm">
                        {FONT_WEIGHT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                      <p className="mt-0.5 text-[10px] text-[color:var(--wsu-muted)]">Card, list, accordion, and table row titles</p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Field label weight</label>
                      <select value={getNumericFontWeightValue("fieldLabelFontWeight")} onChange={(e) => updateStyle("fieldLabelFontWeight", e.target.value)} className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm">
                        {FONT_WEIGHT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                      <p className="mt-0.5 text-[10px] text-[color:var(--wsu-muted)]">Column headers and field labels in cards/lists</p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">People name weight</label>
                      <select value={getNumericFontWeightValue("peopleNameFontWeight")} onChange={(e) => updateStyle("peopleNameFontWeight", e.target.value)} className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm">
                        {FONT_WEIGHT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                      <p className="mt-0.5 text-[10px] text-[color:var(--wsu-muted)]">Name line in grouped people fields (people_group)</p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">People contact weight</label>
                      <select value={getNumericFontWeightValue("peopleDetailFontWeight")} onChange={(e) => updateStyle("peopleDetailFontWeight", e.target.value)} className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm">
                        {FONT_WEIGHT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                      <p className="mt-0.5 text-[10px] text-[color:var(--wsu-muted)]">Email and phone lines in grouped people fields and other value links</p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Value link underline</label>
                      <select
                        value={getValue("valueLinkDecoration") === "none" ? "none" : "underline"}
                        onChange={(e) => {
                          if (e.target.value === "none") {
                            updateStyle("valueLinkDecoration", "none");
                          } else {
                            updateStyle("valueLinkDecoration", "");
                          }
                        }}
                        className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                      >
                        <option value="underline">Underline</option>
                        <option value="none">None</option>
                      </select>
                      <p className="mt-0.5 text-[10px] text-[color:var(--wsu-muted)]">Email, phone, and URL fields on the public view (not print/PDF)</p>
                    </div>
                  </div>
                </div>

                {/* ── Style & case ── */}
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[color:var(--wsu-border)]">Style & case</p>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Body style</label>
                      <select value={getValue("fontStyle")} onChange={(e) => updateStyle("fontStyle", e.target.value)} className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm">
                        {FONT_STYLE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                      <p className="mt-0.5 text-[10px] text-[color:var(--wsu-muted)]">Normal or italic on all body text</p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Heading style</label>
                      <select value={getValue("headingFontStyle")} onChange={(e) => updateStyle("headingFontStyle", e.target.value)} className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm">
                        {FONT_STYLE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                      <p className="mt-0.5 text-[10px] text-[color:var(--wsu-muted)]">Normal or italic on page title, section title, row headings</p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Field label spacing</label>
                      <select value={getValue("fieldLabelLetterSpacing")} onChange={(e) => updateStyle("fieldLabelLetterSpacing", e.target.value)} className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm">
                        {LETTER_SPACING_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                      <p className="mt-0.5 text-[10px] text-[color:var(--wsu-muted)]">Letter spacing on column headers and card field labels</p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Field label case</label>
                      <select value={getValue("fieldLabelTextTransform")} onChange={(e) => updateStyle("fieldLabelTextTransform", e.target.value)} className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm">
                        {TEXT_TRANSFORM_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                      <p className="mt-0.5 text-[10px] text-[color:var(--wsu-muted)]">Uppercase, capitalize, or none on column headers and labels</p>
                    </div>
                  </div>
                </div>

              </div>
            </Section>
          )}

          {designTab === "chips" && (
            <Section title="Chips">
              <p className="text-xs text-[color:var(--wsu-muted)]">
                <strong className="font-semibold text-[color:var(--wsu-ink)]">Campus chips</strong> — styling for program-section strips,
                merged-row campus badges, the{" "}
                <code className="rounded bg-[color:var(--wsu-stone)]/50 px-1 py-0.5 text-[10px]">__campus_badges__</code> card slot, and{" "}
                <strong className="font-semibold text-[color:var(--wsu-ink)]">pills beside names</strong> in people_group (numbered slots with
                campus). For chip <strong className="font-semibold text-[color:var(--wsu-ink)]">colors only</strong>, use Palette → People campus
                chip background / text / border. Separate from palette{" "}
                <strong className="font-semibold text-[color:var(--wsu-ink)]">Badge background / Badge text</strong> (Smartsheet badge columns
                only).
              </p>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Font size</label>
                  <select
                    value={campusFontSize}
                    onChange={(e) => patchCampusBadgeStyle("fontSize", e.target.value)}
                    className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                  >
                    {campusFontSizeSelectOptions.map((opt) => (
                      <option key={opt.value === "" ? "__campus_fs_default__" : opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-0.5 text-[10px] text-[color:var(--wsu-muted)]">
                    Bare numbers (e.g. typing <code className="text-[10px]">40</code> in export/raw config) render as{" "}
                    <code className="text-[10px]">40px</code> on the public view.
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Font weight</label>
                  <select
                    value={campusFontWeight}
                    onChange={(e) => patchCampusBadgeStyle("fontWeight", e.target.value)}
                    className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                  >
                    {campusFontWeightSelectOptions.map((opt) => (
                      <option key={opt.value === "" ? "__campus_fw_default__" : opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Font family</label>
                  <select
                    value={campusFontFamily}
                    onChange={(e) => patchCampusBadgeStyle("fontFamily", e.target.value)}
                    className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                  >
                    {campusFontFamilySelectOptions.map((opt) => (
                      <option key={opt.value === "" ? "__campus_ff_default__" : opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Corner radius</label>
                  <select
                    value={campusBorderRadius}
                    onChange={(e) => patchCampusBadgeStyle("borderRadius", e.target.value)}
                    className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                  >
                    {campusRadiusSelectOptions.map((opt) => (
                      <option key={opt.value === "" ? "__campus_rad_default__" : `${opt.value}-${opt.label}`} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                {(
                  [
                    ["background", "Background"],
                    ["color", "Text color"],
                    ["borderColor", "Border color"],
                  ] as const
                ).map(([token, label]) => (
                  <div key={token}>
                    <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">{label}</label>
                    <div className="flex gap-2">
                      <div className="relative h-9 w-12 shrink-0 overflow-hidden rounded-lg border border-[color:var(--wsu-border)]">
                        <input
                          type="color"
                          value={(getCampusBadge(token) || "").match(/#[0-9A-Fa-f]{3,6}/)?.[0] ?? "#e7e5e4"}
                          onChange={(e) => patchCampusBadgeStyle(token, e.target.value)}
                          className="absolute inset-[-4px] h-[calc(100%+8px)] w-[calc(100%+8px)] cursor-pointer"
                        />
                      </div>
                      <div className="relative min-w-0 flex-1">
                        <input
                          type="text"
                          value={getCampusBadge(token)}
                          onChange={(e) => patchCampusBadgeStyle(token, e.target.value)}
                          placeholder="e.g. radial-gradient(…) or empty"
                          className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-2.5 py-1.5 font-mono text-xs"
                        />
                        {getCampusBadge(token) && (
                          <button
                            type="button"
                            onClick={() => patchCampusBadgeStyle(token, "")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[color:var(--wsu-muted)] hover:text-rose-600"
                            title="Clear"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {designTab === "effects" && (
            <Section title="Cards, radius & shadow">
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Corner radius</label>
                  <select
                    value={getValue("borderRadius")}
                    onChange={(e) => updateStyle("borderRadius", e.target.value)}
                    className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                  >
                    {BORDER_RADIUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Card shadow</label>
                  <select
                    value={getValue("cardShadow")}
                    onChange={(e) => updateStyle("cardShadow", e.target.value)}
                    className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                  >
                    {SHADOW_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </Section>
          )}

          {designTab === "header" && (
            <Section title="Header & masthead">
              <p className="text-xs text-[color:var(--wsu-muted)]">
                Typography and colors for the public page header (logo row, source label, page title, live-data line) and the masthead card. Uses the same reset-to-preset behavior as above.
              </p>
              <div className="grid gap-8 lg:grid-cols-2">
                <div className="space-y-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--wsu-border)]">Masthead card & top rule</p>
                  {HEADER_COLOR_TOKENS.map((token) => (
                    <div key={token}>
                      <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">
                        {HEADER_COLOR_LABELS[token]}
                      </label>
                      <div className="flex gap-2">
                        <div className="relative h-9 w-12 shrink-0 overflow-hidden rounded-lg border border-[color:var(--wsu-border)]">
                          <input
                            type="color"
                            value={(getValue(token) || "").match(/#[0-9A-Fa-f]{3,6}/)?.[0] ?? "#ffffff"}
                            onChange={(e) => updateStyle(token, e.target.value)}
                            className="absolute inset-[-4px] h-[calc(100%+8px)] w-[calc(100%+8px)] cursor-pointer"
                          />
                        </div>
                        <div className="relative min-w-0 flex-1">
                          <input
                            type="text"
                            value={view.style?.[token] ?? ""}
                            onChange={(e) => updateStyle(token, e.target.value)}
                            placeholder={currentPreset.tokens[token] as string}
                            className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-2.5 py-1.5 font-mono text-xs"
                          />
                          {view.style?.[token] && (
                            <button
                              type="button"
                              onClick={() => updateStyle(token, "")}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-[color:var(--wsu-muted)] hover:text-rose-600"
                              title="Reset to preset"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Top rule thickness</label>
                    <select
                      value={getValue("headerTopBorderWidth")}
                      onChange={(e) => updateStyle("headerTopBorderWidth", e.target.value)}
                      className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                    >
                      {HEADER_TOP_BORDER_WIDTH_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Masthead corner radius</label>
                    <select
                      value={getValue("headerPanelBorderRadius")}
                      onChange={(e) => updateStyle("headerPanelBorderRadius", e.target.value)}
                      className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                    >
                      {BORDER_RADIUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Masthead shadow</label>
                    <select
                      value={getValue("headerPanelShadow")}
                      onChange={(e) => updateStyle("headerPanelShadow", e.target.value)}
                      className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                    >
                      {SHADOW_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[color:var(--wsu-border)]">Brand lines (next to logo)</p>
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Subline font</label>
                        <select
                          value={getValue("headerBrandSublineFontFamily")}
                          onChange={(e) => updateStyle("headerBrandSublineFontFamily", e.target.value)}
                          className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                        >
                          {FONT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Subline size</label>
                        <select
                          value={getValue("headerBrandSublineFontSize")}
                          onChange={(e) => updateStyle("headerBrandSublineFontSize", e.target.value)}
                          className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                        >
                          {FONT_SIZE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Subline weight</label>
                        <select
                          value={getNumericFontWeightValue("headerBrandSublineFontWeight")}
                          onChange={(e) => updateStyle("headerBrandSublineFontWeight", e.target.value)}
                          className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                        >
                          {FONT_WEIGHT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Title font</label>
                        <select
                          value={getValue("headerBrandTitleFontFamily")}
                          onChange={(e) => updateStyle("headerBrandTitleFontFamily", e.target.value)}
                          className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                        >
                          {FONT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Title size</label>
                        <select
                          value={getValue("headerBrandTitleFontSize")}
                          onChange={(e) => updateStyle("headerBrandTitleFontSize", e.target.value)}
                          className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                        >
                          {FONT_SIZE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Title weight</label>
                        <select
                          value={getNumericFontWeightValue("headerBrandTitleFontWeight")}
                          onChange={(e) => updateStyle("headerBrandTitleFontWeight", e.target.value)}
                          className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                        >
                          {FONT_WEIGHT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Title style</label>
                        <select
                          value={getValue("headerBrandTitleFontStyle")}
                          onChange={(e) => updateStyle("headerBrandTitleFontStyle", e.target.value)}
                          className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                        >
                          {FONT_STYLE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Title letter-spacing</label>
                        <select
                          value={getValue("headerBrandTitleLetterSpacing")}
                          onChange={(e) => updateStyle("headerBrandTitleLetterSpacing", e.target.value)}
                          className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                        >
                          {LETTER_SPACING_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[color:var(--wsu-border)]">Source label & page title</p>
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Source label font</label>
                        <select
                          value={getValue("headerSourceLabelFontFamily")}
                          onChange={(e) => updateStyle("headerSourceLabelFontFamily", e.target.value)}
                          className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                        >
                          {FONT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Source label size</label>
                        <select
                          value={getValue("headerSourceLabelFontSize")}
                          onChange={(e) => updateStyle("headerSourceLabelFontSize", e.target.value)}
                          className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                        >
                          {FONT_SIZE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Source label weight</label>
                        <select
                          value={getNumericFontWeightValue("headerSourceLabelFontWeight")}
                          onChange={(e) => updateStyle("headerSourceLabelFontWeight", e.target.value)}
                          className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                        >
                          {FONT_WEIGHT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Source label tracking</label>
                        <select
                          value={getValue("headerSourceLabelLetterSpacing")}
                          onChange={(e) => updateStyle("headerSourceLabelLetterSpacing", e.target.value)}
                          className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                        >
                          {LETTER_SPACING_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Source label case</label>
                        <select
                          value={getValue("headerSourceLabelTextTransform")}
                          onChange={(e) => updateStyle("headerSourceLabelTextTransform", e.target.value)}
                          className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                        >
                          {TEXT_TRANSFORM_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Page title font</label>
                        <select
                          value={getValue("headerPageTitleFontFamily")}
                          onChange={(e) => updateStyle("headerPageTitleFontFamily", e.target.value)}
                          className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                        >
                          {FONT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Page title size (header only)</label>
                        <select
                          value={getValue("headerPageTitleFontSize")}
                          onChange={(e) => updateStyle("headerPageTitleFontSize", e.target.value)}
                          className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                        >
                          {FONT_SIZE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Page title weight</label>
                        <select
                          value={getNumericFontWeightValue("headerPageTitleFontWeight")}
                          onChange={(e) => updateStyle("headerPageTitleFontWeight", e.target.value)}
                          className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                        >
                          {FONT_WEIGHT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Page title style</label>
                        <select
                          value={getValue("headerPageTitleFontStyle")}
                          onChange={(e) => updateStyle("headerPageTitleFontStyle", e.target.value)}
                          className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                        >
                          {FONT_STYLE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Page title tracking</label>
                        <select
                          value={getValue("headerPageTitleLetterSpacing")}
                          onChange={(e) => updateStyle("headerPageTitleLetterSpacing", e.target.value)}
                          className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                        >
                          {LETTER_SPACING_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[color:var(--wsu-border)]">Live data line</p>
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[color:var(--wsu-muted)]">Line size</label>
                        <select
                          value={getValue("headerLiveBlurbFontSize")}
                          onChange={(e) => updateStyle("headerLiveBlurbFontSize", e.target.value)}
                          className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                        >
                          {FONT_SIZE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Section>
          )}

          <p className="text-xs text-[color:var(--wsu-muted)]">
            Tokens with × are overrides. Click × to reset to the preset default.
          </p>
        </div>
      )}
    </div>
  );
}
