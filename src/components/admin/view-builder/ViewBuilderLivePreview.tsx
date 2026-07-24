"use client";

import { PublicHeaderBrandStrip } from "@/components/views/shell/PublicHeaderBrandStrip";
import { ViewStyleWrapper } from "@/components/views/shell/ViewStyleWrapper";
import { ViewWithSearchAndIndex } from "@/components/views/layouts/ViewWithSearchAndIndex";
import { LAYOUT_OPTIONS, formatLayoutLabel } from "@/lib/config/options";
import { isHtmlContent, parseFormattedHeaderText, renderHeaderCustomText } from "@/lib/rendering";
import type { ViewConfig } from "@/lib/config/types";
import type { ResolvedView } from "@/lib/config/types";

export function ViewBuilderLivePreview({
  subtitle,
  view,
  sourceMap,
  livePreview,
  livePreviewLoading,
  livePreviewError,
  showEmptyAndErrorStates = true,
}: {
  subtitle: string;
  view: ViewConfig;
  sourceMap: Map<string, string>;
  livePreview: { resolvedView: ResolvedView; warnings: string[] } | null;
  livePreviewLoading: boolean;
  livePreviewError: string | null;
  showEmptyAndErrorStates?: boolean;
}) {
  return (
    <>
      <p className="text-sm font-semibold text-[color:var(--wsu-ink)]">Live preview</p>
      <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">{subtitle}</p>
      {livePreviewLoading ? (
        <p className="mt-4 text-sm text-[color:var(--wsu-muted)]">Loading…</p>
      ) : livePreview ? (
        <div className="mt-3 max-h-[500px] overflow-auto rounded-xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/20 p-3">
          <div className="scale-[0.85] origin-top">
            <ViewStyleWrapper style={livePreview.resolvedView.style} themePresetId={livePreview.resolvedView.themePresetId}>
              {!view.presentation?.hideHeader && (
              <header className="view-header-panel px-6 py-6">
                <div className="flex flex-wrap items-start justify-between gap-6">
                  <div className="min-w-0 flex-1 space-y-3">
                    <PublicHeaderBrandStrip presentation={view.presentation} />
                    {!view.presentation?.hideHeaderBackLink && (
                      <span className="text-[10px] font-medium text-[color:var(--wsu-muted)]">
                        Back to configured pages
                      </span>
                    )}
                    <div>
                      {!view.presentation?.hideHeaderSourceLabel && (
                        <p className="view-header-source-label">{sourceMap.get(view.sourceId) ?? "Source Label"}</p>
                      )}
                      {!view.presentation?.hideHeaderPageTitle && (
                        <h1 className="view-header-page-title mt-1">{view.label || "Page Title"}</h1>
                      )}
                    </div>
                    {view.presentation?.headerCustomText && (
                      <div className="mt-2 text-xs leading-5 text-[color:var(--wsu-ink)]">
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
                                      className="text-[color:var(--wsu-crimson)] underline"
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
                      <div className="rounded-[1.5rem] border border-[color:var(--wsu-border)] bg-white px-4 py-4 text-[10px] text-[color:var(--wsu-muted)] leading-tight">
                        {!view.presentation?.hideHeaderActiveView && (
                          <p>
                            <span className="font-view-heading font-semibold">Active view:</span> {view.label}
                          </p>
                        )}
                        {!view.presentation?.hideHeaderRows && (
                          <p className={!view.presentation?.hideHeaderActiveView ? "mt-1.5" : ""}>
                            <span className="font-semibold text-[color:var(--wsu-ink)]">Rows:</span> {livePreview.resolvedView.rowCount}
                          </p>
                        )}
                        {!view.presentation?.hideHeaderRefreshed && (
                          <p className={!view.presentation?.hideHeaderActiveView || !view.presentation?.hideHeaderRows ? "mt-1.5" : ""}>
                            <span className="font-view-heading font-semibold">Refreshed:</span> {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </header>
              )}
              <div className="mt-4 space-y-4">
                {!view.presentation?.hideViewTabs && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    <span className="rounded-full border border-[color:var(--wsu-crimson)] bg-[color:var(--wsu-crimson)] px-4 py-2 text-[10px] font-medium text-white whitespace-nowrap">
                      {view.presentation?.viewTabLabel ?? view.label}
                      {!view.presentation?.hideViewTabCount && ` ${livePreview.resolvedView.rowCount}`}
                    </span>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {!view.presentation?.hideViewTitleSection && (
                    <div>
                      <h2 className="font-view-heading text-lg font-semibold">{view.label}</h2>
                      {view.description && (
                        <p className="mt-1 text-[10px] text-[color:var(--wsu-muted)]">{view.description}</p>
                      )}
                    </div>
                  )}
                  {!view.fixedLayout && (
                    <div className="flex flex-wrap gap-2">
                      {LAYOUT_OPTIONS.map((option) => {
                        const active = option === livePreview.resolvedView.layout;
                        return (
                          <span
                            key={option}
                            className={`rounded-full border px-2 py-1 text-[10px] font-medium ${
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
                <ViewWithSearchAndIndex view={livePreview.resolvedView} layout={livePreview.resolvedView.layout} embed={false} />
              </div>
            </ViewStyleWrapper>
          </div>
        </div>
      ) : showEmptyAndErrorStates ? (
        livePreviewError ? (
          <p className="mt-4 text-sm text-amber-600">{livePreviewError}</p>
        ) : (
          <p className="mt-4 text-sm text-[color:var(--wsu-muted)]">Preview will appear when data is loaded. Ensure the view is saved and the source has data.</p>
        )
      ) : null}
    </>
  );
}
