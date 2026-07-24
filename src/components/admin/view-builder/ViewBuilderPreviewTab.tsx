"use client";

import { PublicHeaderBrandStrip } from "@/components/views/shell/PublicHeaderBrandStrip";
import { ViewStyleWrapper } from "@/components/views/shell/ViewStyleWrapper";
import { ViewWithSearchAndIndex } from "@/components/views/layouts/ViewWithSearchAndIndex";
import { LAYOUT_OPTIONS, formatLayoutLabel } from "@/lib/config/options";
import { isHtmlContent, parseFormattedHeaderText, renderHeaderCustomText } from "@/lib/rendering";
import type { ViewConfig } from "@/lib/config/types";
import type { ResolvedView } from "@/lib/config/types";

export function ViewBuilderPreviewTab({
  view,
  sourceMap,
  previewViewport,
  setPreviewViewport,
  previewLoading,
  previewError,
  previewData,
  fetchPreview,
}: {
  view: ViewConfig;
  sourceMap: Map<string, string>;
  previewViewport: "full" | "768" | "375";
  setPreviewViewport: (vp: "full" | "768" | "375") => void;
  previewLoading: boolean;
  previewError: string;
  previewData: { resolvedView: ResolvedView; warnings: string[] } | null;
  fetchPreview: () => Promise<void>;
}) {
  return (
    <div id="tabpanel-preview" role="tabpanel" aria-labelledby="tab-preview" className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {(["full", "768", "375"] as const).map((vp) => (
                <button
                  key={vp}
                  type="button"
                  onClick={() => setPreviewViewport(vp)}
                  className={`min-h-[44px] rounded-full border px-4 py-2 text-sm font-medium ${
                    previewViewport === vp
                      ? "border-[color:var(--wsu-crimson)] bg-[color:var(--wsu-crimson)] text-white"
                      : "border-[color:var(--wsu-border)] bg-white text-[color:var(--wsu-muted)]"
                  }`}
                >
                  {vp === "full" ? "Full" : vp === "768" ? "Tablet (768px)" : "Mobile (375px)"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void fetchPreview()}
              disabled={previewLoading}
              className="min-h-[44px] rounded-full border border-[color:var(--wsu-border)] bg-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {previewLoading ? "Loading…" : "Refresh preview"}
            </button>
          </div>
          {previewError && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{previewError}</p>
          )}
          {previewData?.warnings && previewData.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p className="font-semibold">Schema drift warnings</p>
              <ul className="mt-1 list-disc pl-4">
                {previewData.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          {previewData && (
            <div className="flex justify-center rounded-2xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/20 p-4">
              <div
                className="w-full bg-[#f9f4ef] p-4 sm:p-6 lg:p-8"
                style={{ maxWidth: previewViewport === "full" ? "100%" : previewViewport === "768" ? 768 : 375 }}
              >
                <div className="mx-auto max-w-7xl space-y-6 text-left">
                  <ViewStyleWrapper style={previewData.resolvedView.style} themePresetId={previewData.resolvedView.themePresetId}>
                    {!view.presentation?.hideHeader && (
                    <header className="view-header-panel px-6 py-6 sm:px-8">
                      <div className="flex flex-wrap items-start justify-between gap-6">
                        <div className="min-w-0 flex-1 space-y-3">
                          <PublicHeaderBrandStrip presentation={view.presentation} />
                          {!view.presentation?.hideHeaderBackLink && (
                            <span className="text-sm font-medium text-[color:var(--wsu-muted)]">
                              Back to configured pages
                            </span>
                          )}
                          <div>
                            {!view.presentation?.hideHeaderSourceLabel && (
                              <p className="view-header-source-label">{sourceMap.get(view.sourceId) ?? "Source Label"}</p>
                            )}
                            {!view.presentation?.hideHeaderPageTitle && (
                              <h1 className="view-header-page-title mt-2">{view.label || "Page Title"}</h1>
                            )}
                            {!view.presentation?.hideHeaderLiveDataText && (
                              <p className="view-header-live-blurb mt-3 max-w-3xl">
                                Live data from{" "}
                                <span className="view-header-live-blurb-strong font-medium">Smartsheet Asset</span>.
                              </p>
                            )}
                          </div>
                          {view.presentation?.headerCustomText && (
                            <div className="mt-3 text-sm leading-6 text-[color:var(--wsu-ink)]">
                              {isHtmlContent(view.presentation.headerCustomText) ? (
                                <div
                                  className="custom-header-text [&_a]:text-[color:var(--wsu-crimson)] [&_a]:underline"
                                  dangerouslySetInnerHTML={{
                                    __html: renderHeaderCustomText(
                                      view.presentation.headerCustomText,
                                      `https://example.com/view/${view.slug || "slug"}?view=${view.id}`
                                    ),
                                  }}
                                />
                              ) : (
                                <div className="custom-header-text">
                                  {view.presentation.headerCustomText.split("\n").map((line, i) => (
                                    <p key={i} className="whitespace-pre-wrap">
                                      {parseFormattedHeaderText(
                                        line, 
                                        `https://example.com/view/${view.slug || "slug"}?view=${view.id}`
                                      ).map((part, j) =>
                                        typeof part === "string" ? (
                                          <span key={j}>{part}</span>
                                        ) : (
                                          <span
                                            key={j}
                                            className="text-[color:var(--wsu-crimson)] underline cursor-pointer"
                                          >
                                            {part.c}
                                          </span>
                                        )
                                      )}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {/* Info Box */}
                        {!view.presentation?.hideHeaderInfoBox && 
                          (!view.presentation?.hideHeaderActiveView || 
                           !view.presentation?.hideHeaderRows || 
                           !view.presentation?.hideHeaderRefreshed) && (
                          <div className="shrink-0">
                            <div className="rounded-[1.5rem] border border-[color:var(--wsu-border)] bg-white px-4 py-4 text-sm text-[color:var(--wsu-muted)]">
                              {!view.presentation?.hideHeaderActiveView && (
                                <p>
                                  <span className="font-view-heading font-semibold">Active view:</span> {view.label}
                                </p>
                              )}
                              {!view.presentation?.hideHeaderRows && (
                                <p className={!view.presentation?.hideHeaderActiveView ? "mt-2" : ""}>
                                  <span className="font-semibold text-[color:var(--wsu-ink)]">Rows:</span> {previewData.resolvedView.rowCount}
                                </p>
                              )}
                              {!view.presentation?.hideHeaderRefreshed && (
                                <p className={!view.presentation?.hideHeaderActiveView || !view.presentation?.hideHeaderRows ? "mt-2" : ""}>
                                  <span className="font-view-heading font-semibold">Refreshed:</span> {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </header>
                    )}

                    <section className="mt-6 space-y-4">
                      {!view.presentation?.hideViewTabs && (
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          <span className="rounded-full border border-[color:var(--wsu-crimson)] bg-[color:var(--wsu-crimson)] px-4 py-2 text-sm font-medium text-white whitespace-nowrap">
                            {view.presentation?.viewTabLabel ?? view.label}
                          </span>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        {!view.presentation?.hideViewTitleSection && (
                          <div>
                            <h2 className="font-view-heading text-2xl font-semibold">{view.label}</h2>
                            {view.description && (
                              <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">{view.description}</p>
                            )}
                          </div>
                        )}
                        {!view.fixedLayout && (
                          <div className="flex flex-wrap gap-2">
                            {LAYOUT_OPTIONS.map((option) => {
                              const active = option === previewData.resolvedView.layout;
                              return (
                                <span
                                  key={option}
                                  className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                                    active
                                      ? "border-[color:var(--wsu-crimson)] bg-[color:var(--wsu-crimson)] text-white"
                                      : "border-[color:var(--wsu-border)] bg-white text-[color:var(--wsu-muted)]"
                                  }`}
                                >
                                  {formatLayoutLabel(option)}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <ViewWithSearchAndIndex view={previewData.resolvedView} layout={previewData.resolvedView.layout} embed={false} />
                    </section>
                  </ViewStyleWrapper>
                </div>
              </div>
            </div>
          )}
    </div>
  );
}
