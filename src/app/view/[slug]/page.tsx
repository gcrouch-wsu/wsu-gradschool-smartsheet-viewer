import Link from "next/link";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { ToastProvider } from "@/components/ui/Toast";
import { EmbedHeightReporter } from "@/components/views/shell/EmbedHeightReporter";
import { PublicHeaderBrandStrip } from "@/components/views/shell/PublicHeaderBrandStrip";
import { ViewStyleWrapper } from "@/components/views/shell/ViewStyleWrapper";
import { ViewWithSearchAndIndex } from "@/components/views/layouts/ViewWithSearchAndIndex";
import { ViewTabs } from "@/components/views/shell/ViewTabs";
import { LAYOUT_OPTIONS, formatLayoutLabel } from "@/lib/config/options";
import type { LayoutType } from "@/lib/config/types";
import { mergeThemeTokens } from "@/lib/config/themes";
import { ADMIN_SESSION_COOKIE_NAME } from "@/lib/admin-auth";
import { resolveAdminPrincipalFromSession } from "@/lib/admin-users";
import {
  CONTRIBUTOR_SESSION_COOKIE_NAME,
  getContributorConfigurationError,
  readContributorSessionToken,
} from "@/lib/contributor-auth";
import {
  buildContributorEditingClientConfig,
  collectResolvableRowIdsForUnrestrictedEditing,
  getEditableRowIdsForView,
  isContributorRowOrMergedEditable,
  isContributorStillInSheet,
} from "@/lib/contributor-utils";
import { CONTRIBUTOR_DATASET_OPTIONS, loadContributorDataset } from "@/lib/contributor-view";
import { formatFetchedAtInViewTimeZone } from "@/lib/display-datetime";
import {
  loadPublicPageState,
  resolveRequestedResolvedView,
  resolveRequestedViewConfig,
} from "@/lib/public-view";
import { publicContributorLoginHref, publicInteractiveHref, publicPrintHref } from "@/lib/public-view-href";
import { getPublicOrigin } from "@/lib/request-ip";
import { omitRecordSuppressedRowsFromResolvedView } from "@/lib/record-suppression";
import { isHtmlContent, parseFormattedHeaderText, renderHeaderCustomText } from "@/lib/rendering";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function PublicActionLink({
  href,
  label,
  primary = false,
  newWindow = false,
  compact = false,
}: {
  href: string;
  label: string;
  primary?: boolean;
  newWindow?: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      target={newWindow ? "_blank" : undefined}
      rel={newWindow ? "noopener noreferrer" : undefined}
      title={newWindow ? `${label} (opens in a new window)` : undefined}
      className={`${primary ? "link-pill" : "link-pill-muted"} justify-center whitespace-nowrap${compact ? " text-xs" : ""}`}
      style={compact ? { padding: "0.4rem 0.75rem" } : undefined}
    >
      {label}
    </Link>
  );
}

export default async function PublicViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;

  let page;
  try {
    page = await loadPublicPageState(slug);
  } catch (error) {
    console.error(`[smartsheets_view] Failed to load public page "${slug}":`, error);
    return (
      <main className="flex min-h-screen items-center justify-center bg-[color:var(--wsu-stone)] px-4 text-center">
        <div className="max-w-md space-y-4 rounded-3xl border border-[color:var(--wsu-border)] bg-white p-8 shadow-xl">
          <h1 className="text-2xl font-bold text-[color:var(--wsu-crimson)]">Application Error</h1>
          <p className="text-sm text-[color:var(--wsu-muted)]">
            We encountered a problem loading this data view. This usually happens if the Smartsheet source is unavailable or the configuration is incomplete.
          </p>
          {process.env.NODE_ENV !== "production" && (
            <div className="max-h-32 overflow-auto rounded bg-gray-50 p-2 text-left font-mono text-[10px]">
              {error instanceof Error ? error.message : String(error)}
            </div>
          )}
          <Link
            href="/"
            className="btn-crimson inline-block rounded-full bg-[color:var(--wsu-crimson)] px-6 py-2 text-sm font-medium"
          >
            Return home
          </Link>
        </div>
      </main>
    );
  }

  if (!page) {
    notFound();
  }

  const requestedView = firstValue(resolvedSearchParams.view);
  const requestedLayout = firstValue(resolvedSearchParams.layout);
  const embed = firstValue(resolvedSearchParams.embed) === "1";
  const activeView = resolveRequestedResolvedView(page.resolvedViews, page.defaultViewId, requestedView);
  const activeViewConfig = resolveRequestedViewConfig(page.viewConfigs, requestedView);

  if (!activeView || !activeViewConfig) {
    notFound();
  }

  const layout =
    activeView.fixedLayout
      ? activeView.layout
      : LAYOUT_OPTIONS.includes(requestedLayout as LayoutType)
        ? (requestedLayout as LayoutType)
        : activeView.layout;

  const mainClassName = embed ? "bg-transparent px-0 py-0" : "min-h-screen px-4 py-6 sm:px-6 lg:px-8";
  const containerClassName = embed ? "mx-auto max-w-none space-y-4" : "mx-auto max-w-7xl space-y-5";
  const tokens = mergeThemeTokens(activeView.themePresetId ?? "wsu_crimson", activeView.style);
  const mainStyle = !embed && tokens.backgroundColor ? { backgroundColor: tokens.backgroundColor } : undefined;

  const showViewTabs = !activeView.presentation?.hideViewTabs && page.resolvedViews.length > 1;
  const singlePublishedView = page.viewConfigs.length === 1;
  const contributorConfigurationError = getContributorConfigurationError();
  const editingEnabled = !embed && activeViewConfig.editing?.enabled && !contributorConfigurationError;
  const showContributorLoginLink = editingEnabled && activeViewConfig.editing?.showLoginLink !== false;
  const loginHref = showContributorLoginLink
    ? publicContributorLoginHref(slug, activeView.id, singlePublishedView)
    : null;
  const showContributorInstructions =
    editingEnabled && activeViewConfig.editing?.showContributorInstructions !== false;
  const printHref = !embed ? publicPrintHref(slug, activeView.id, singlePublishedView) : null;
  const exportCsvHref = !embed
    ? `/api/public/views/${encodeURIComponent(slug)}/export?viewId=${encodeURIComponent(activeView.id)}`
    : null;
  const publicPath = publicInteractiveHref(slug, activeView.id, singlePublishedView);
  const publicOrigin = getPublicOrigin(await headers());
  const headerPublicUrl = publicOrigin ? `${publicOrigin}${publicPath}` : publicPath;
  const contributorInstructionsHref = showContributorInstructions ? "/instructions/contributor" : null;
  const layoutSwitcher = !activeView.fixedLayout ? (
    <nav aria-label="Layout" className="view-control-group view-control-group--layouts">
      {LAYOUT_OPTIONS.map((option) => {
        const active = option === layout;
        return (
          <Link
            key={option}
            href={publicInteractiveHref(slug, activeView.id, singlePublishedView, { layout: option, embed })}
            aria-current={active ? "page" : undefined}
            className={active ? "view-control-active" : "view-control"}
          >
            {formatLayoutLabel(option)}
          </Link>
        );
      })}
    </nav>
  ) : null;

  let contributorEmail: string | null = null;
  let editingConfig = null;
  let editableRowIds: number[] = [];
  let adminUnrestrictedEditing = false;
  let adminEditingLabel: string | null = null;

  if (editingEnabled) {
    const cookieStore = await cookies();
    const adminAuth = await resolveAdminPrincipalFromSession(cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value);

    if (adminAuth.ok && adminAuth.principal) {
      const dataset = await loadContributorDataset(page.sourceConfig, CONTRIBUTOR_DATASET_OPTIONS);
      const built = buildContributorEditingClientConfig(activeViewConfig, dataset.columns, page.sourceConfig);
      if (built) {
        adminUnrestrictedEditing = true;
        editingConfig = built;
        editableRowIds = collectResolvableRowIdsForUnrestrictedEditing(activeView.rows);
        adminEditingLabel =
          (adminAuth.principal.displayName ?? adminAuth.principal.username).trim() || "Administrator";
      }
    }

    if (!adminUnrestrictedEditing) {
      const session = await readContributorSessionToken(cookieStore.get(CONTRIBUTOR_SESSION_COOKIE_NAME)?.value);

      if (session.ok && session.payload) {
        const dataset = await loadContributorDataset(page.sourceConfig, CONTRIBUTOR_DATASET_OPTIONS);
        if (isContributorStillInSheet(dataset.rows, session.payload.email, activeViewConfig.editing!.contactColumnIds)) {
          contributorEmail = session.payload.email;
          editingConfig = buildContributorEditingClientConfig(activeViewConfig, dataset.columns, page.sourceConfig);
          editableRowIds = getEditableRowIdsForView(dataset.rows, activeViewConfig, contributorEmail);
        }
      }
    }
  }

  const showPublicEditingChrome = Boolean(contributorEmail || adminUnrestrictedEditing);

  /** Signed-in contributors only see rows they are allowed to edit (no scrolling through everyone). */
  let viewForDisplay = activeView;
  if (!adminUnrestrictedEditing && contributorEmail && editableRowIds.length > 0) {
    const editableSet = new Set(editableRowIds);
    const rows = activeView.rows.filter((row) => isContributorRowOrMergedEditable(row, editableSet));
    viewForDisplay = { ...activeView, rows, rowCount: rows.length };
  }

  /** Hide/delete-status rows are omitted entirely for anonymous public (not for contributors or admin editing). */
  if (!showPublicEditingChrome) {
    viewForDisplay = omitRecordSuppressedRowsFromResolvedView(viewForDisplay);
  }

  return (
    <main className={mainClassName} style={mainStyle}>
      {!embed && (
        <a
          href="#main-view-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:border focus:border-[color:var(--wsu-border)] focus:bg-[color:var(--wsu-paper)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-[color:var(--wsu-crimson)] focus:shadow-lg"
        >
          Skip to main content
        </a>
      )}
      {embed && <EmbedHeightReporter />}
      <div className={containerClassName}>
        <ViewStyleWrapper style={activeView.style} themePresetId={activeView.themePresetId}>
          {!embed && !activeView.presentation?.hideHeader && (
            <div>
            <header className="view-header-panel px-5 py-5 sm:px-6 sm:py-6">
              <div className="flex flex-wrap items-start justify-between gap-5 lg:gap-8">
                <div className="min-w-0 flex-1 space-y-2.5">
                  <PublicHeaderBrandStrip presentation={activeView.presentation} />
                  {!activeView.presentation?.hideHeaderBackLink &&
                    (showPublicEditingChrome ? (
                      <p className="text-sm text-[color:var(--wsu-muted)]">
                        <Link href="/" className="link-inline">
                          All views
                        </Link>
                        <span className="mt-1 block text-xs text-[color:var(--wsu-muted)]">
                          {adminUnrestrictedEditing ? (
                            <>
                              End your admin session from the{" "}
                              <strong className="font-medium text-[color:var(--wsu-ink)]">Admin</strong> area. Browser
                              Back may leave this site—use this link to return to the catalog.
                            </>
                          ) : (
                            <>
                              Use <strong className="font-medium text-[color:var(--wsu-ink)]">Sign out</strong> below to
                              change accounts. Browser Back may go to other sites you opened earlier—use this link to
                              stay in public views.
                            </>
                          )}
                        </span>
                      </p>
                    ) : (
                      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-1.5 text-xs">
                        <Link href="/" className="link-inline-muted !font-medium !no-underline hover:!underline">
                          All views
                        </Link>
                        {!activeView.presentation?.hideHeaderSourceLabel ? (
                          <>
                            <span className="text-[color:var(--wsu-border)]" aria-hidden>
                              /
                            </span>
                            <span className="view-header-source-label">{page.sourceConfig.label}</span>
                          </>
                        ) : null}
                      </nav>
                    ))}
                  <div>
                    {(!activeView.presentation?.hideHeaderBackLink && !showPublicEditingChrome) ||
                    activeView.presentation?.hideHeaderSourceLabel
                      ? null
                      : !activeView.presentation?.hideHeaderSourceLabel && (
                          <p className="view-header-source-label">{page.sourceConfig.label}</p>
                        )}
                    {!activeView.presentation?.hideHeaderPageTitle && (
                      <h1 className="view-header-page-title mt-1.5 text-balance">{page.title}</h1>
                    )}
                    {!activeView.presentation?.hideViewTitleSection &&
                      (activeView.label !== page.title || activeView.description) && (
                        <div className="mt-2.5 max-w-3xl">
                          {activeView.label !== page.title ? (
                            <p className="view-section-title text-[1.125rem] leading-snug text-[color:var(--wsu-ink)]">
                              {activeView.label}
                            </p>
                          ) : null}
                          {activeView.description ? (
                            <p
                              className={`text-sm leading-relaxed text-[color:var(--wsu-muted)] ${
                                activeView.label !== page.title ? "mt-0.5" : ""
                              }`}
                            >
                              {activeView.description}
                            </p>
                          ) : null}
                        </div>
                      )}
                    {!activeView.presentation?.hideHeaderLiveDataText && (
                      <p className="view-header-live-blurb mt-2 max-w-2xl !leading-relaxed">
                        Live data from{" "}
                        <span className="view-header-live-blurb-strong font-medium">{page.sourceName}</span>.
                      </p>
                    )}
                  </div>
                  {activeView.presentation?.headerCustomText &&
                    (isHtmlContent(activeView.presentation.headerCustomText) ? (
                      <div
                        className="custom-header-text mt-3 text-sm leading-6 text-[color:var(--wsu-ink)] [&_a]:relative [&_a]:z-[1] [&_a]:cursor-pointer [&_a]:text-[color:var(--wsu-crimson)] [&_a]:underline [&_a]:hover:text-[color:var(--wsu-crimson-dark)]"
                        dangerouslySetInnerHTML={{
                          __html: renderHeaderCustomText(
                            activeView.presentation.headerCustomText,
                            headerPublicUrl,
                          ),
                        }}
                      />
                    ) : (
                      <div className="custom-header-text mt-3 text-sm leading-6 text-[color:var(--wsu-ink)]">
                        {activeView.presentation.headerCustomText.split("\n").map((line, i) => (
                          <p key={i} className="whitespace-pre-wrap">
                            {parseFormattedHeaderText(line, headerPublicUrl).map((part, j) =>
                              typeof part === "string" ? (
                                <span key={j}>{part}</span>
                              ) : part.t === "b" ? (
                                <strong key={j}>{part.c}</strong>
                              ) : part.t === "i" ? (
                                <em key={j}>{part.c}</em>
                              ) : (
                                <a
                                  key={j}
                                  href={part.c}
                                  className="relative z-[1] cursor-pointer text-[color:var(--wsu-crimson)] underline hover:text-[color:var(--wsu-crimson-dark)]"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {part.c}
                                </a>
                              ),
                            )}
                          </p>
                        ))}
                      </div>
                    ))}
                </div>
                {((!activeView.presentation?.hideHeaderInfoBox &&
                  (!activeView.presentation?.hideHeaderActiveView ||
                    !activeView.presentation?.hideHeaderRows ||
                    !activeView.presentation?.hideHeaderRefreshed)) ||
                  layoutSwitcher ||
                  ((loginHref && !showPublicEditingChrome) || printHref || exportCsvHref || contributorInstructionsHref)) && (
                  <div className="w-full shrink-0 sm:w-auto sm:min-w-[28rem] lg:min-w-[32rem]">
                    <div className="view-surface-muted rounded-xl border border-[color:var(--wsu-border)] px-3.5 py-3.5 text-sm text-[color:var(--wsu-muted)]">
                      {!activeView.presentation?.hideHeaderInfoBox &&
                        (!activeView.presentation?.hideHeaderActiveView ||
                          !activeView.presentation?.hideHeaderRows ||
                          !activeView.presentation?.hideHeaderRefreshed) && (
                          <dl className="view-header-meta">
                            <div className="meta-row flex flex-wrap items-baseline gap-x-3 gap-y-1">
                              {!activeView.presentation?.hideHeaderRows && (
                                <div>
                                  <dt>Rows</dt>
                                  <dd>
                                    {" "}
                                    {contributorEmail && editableRowIds.length > 0 ? (
                                      <>
                                        <span className="tabular-nums text-[color:var(--wsu-ink)]">
                                          {viewForDisplay.rowCount}
                                        </span>
                                        <span> assigned</span>
                                        <span className="text-[color:var(--wsu-muted)]">
                                          {" "}
                                          ({activeView.rowCount} in view)
                                        </span>
                                      </>
                                    ) : (
                                      <span className="tabular-nums text-[color:var(--wsu-ink)]">
                                        {activeView.rowCount}
                                      </span>
                                    )}
                                  </dd>
                                </div>
                              )}
                              {!activeView.presentation?.hideHeaderRefreshed && (
                                <div>
                                  <dt>Refreshed</dt>
                                  <dd>
                                    {" "}
                                    <time dateTime={page.fetchedAt} className="tabular-nums">
                                      {formatFetchedAtInViewTimeZone(page.fetchedAt, activeView.displayTimeZone)}
                                    </time>
                                  </dd>
                                </div>
                              )}
                            </div>
                            {!activeView.presentation?.hideHeaderActiveView &&
                              !showViewTabs &&
                              (activeView.presentation?.hideViewTitleSection ||
                                (activeView.label === page.title && !activeView.description)) && (
                                <div className="meta-row mt-1">
                                  <dt>View</dt>
                                  <dd> {activeView.label}</dd>
                                </div>
                              )}
                          </dl>
                        )}

                      {layoutSwitcher ? (
                        <div
                          className={
                            !activeView.presentation?.hideHeaderInfoBox
                              ? "mt-3 border-t border-[color:var(--wsu-border)]/70 pt-3"
                              : ""
                          }
                        >
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--wsu-muted)]">
                            Layout
                          </p>
                          {layoutSwitcher}
                        </div>
                      ) : null}

                      {!showPublicEditingChrome &&
                      (loginHref || printHref || exportCsvHref || contributorInstructionsHref) ? (
                        <div
                          className={
                            !activeView.presentation?.hideHeaderInfoBox || layoutSwitcher
                              ? "mt-3 border-t border-[color:var(--wsu-border)]/70 pt-3"
                              : ""
                          }
                        >
                          <div className="flex flex-wrap gap-1.5">
                            {loginHref ? (
                              <PublicActionLink href={loginHref} label="Contributor sign in" primary compact />
                            ) : null}
                            {printHref ? <PublicActionLink href={printHref} label="Print / PDF" compact /> : null}
                            {exportCsvHref ? (
                              <PublicActionLink href={exportCsvHref} label="Export CSV" compact />
                            ) : null}
                            {contributorInstructionsHref ? (
                              <PublicActionLink
                                href={contributorInstructionsHref}
                                label="Contributor instructions"
                                newWindow
                                compact
                              />
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </header>
            </div>
          )}

          <section id="main-view-content" className={embed ? "space-y-3 scroll-mt-4" : "space-y-4 scroll-mt-4"}>
            {showViewTabs && (
              <ViewTabs
                slug={slug}
                views={page.resolvedViews.map((raw) => {
                  const view = showPublicEditingChrome ? raw : omitRecordSuppressedRowsFromResolvedView(raw);
                  return {
                    id: view.id,
                    label: view.presentation?.viewTabLabel ?? view.label,
                    rowCount: view.rowCount,
                    hideCount: view.presentation?.hideViewTabCount,
                  };
                })}
                activeViewId={activeView.id}
                layout={layout}
                embed={embed}
              />
            )}

            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                {activeView.presentation?.hideHeader &&
                  !activeView.presentation?.hideViewTitleSection &&
                  (activeView.label !== page.title || activeView.description) && (
                  <>
                    <h2 className="view-section-title text-[1.25rem] leading-snug">{activeView.label}</h2>
                    {activeView.description && (
                      <p className="mt-0.5 max-w-3xl text-sm text-[color:var(--wsu-muted)]">{activeView.description}</p>
                    )}
                  </>
                )}
                {!embed &&
                  !showPublicEditingChrome &&
                  activeView.presentation?.hideHeader &&
                  (loginHref || printHref || exportCsvHref || contributorInstructionsHref) && (
                  <div
                    className={`${
                      !activeView.presentation?.hideViewTitleSection &&
                      (activeView.label !== page.title || activeView.description)
                        ? "mt-3 "
                        : ""
                    }flex flex-wrap gap-2`}
                  >
                    {loginHref ? <PublicActionLink href={loginHref} label="Contributor sign in" primary /> : null}
                    {printHref ? <PublicActionLink href={printHref} label="Print / PDF" /> : null}
                    {exportCsvHref ? <PublicActionLink href={exportCsvHref} label="Export CSV" /> : null}
                    {contributorInstructionsHref ? (
                      <PublicActionLink href={contributorInstructionsHref} label="Contributor instructions" newWindow />
                    ) : null}
                  </div>
                )}
              </div>
              {activeView.presentation?.hideHeader ? <div className="flex flex-wrap items-center gap-3">{layoutSwitcher}</div> : null}
            </div>

            <ToastProvider>
              <ViewWithSearchAndIndex
                view={viewForDisplay}
                layout={layout}
                embed={embed}
                slug={slug}
                viewId={activeView.id}
                contributorEmail={contributorEmail}
                editingConfig={editingConfig}
                editableRowIds={editableRowIds}
                adminUnrestrictedEditing={adminUnrestrictedEditing}
                adminEditingLabel={adminEditingLabel}
                contributorRowsFiltered={Boolean(contributorEmail && editableRowIds.length > 0)}
                printHref={printHref ?? undefined}
                contributorInstructionsHref={contributorInstructionsHref ?? undefined}
              />
            </ToastProvider>
          </section>
        </ViewStyleWrapper>
      </div>
    </main>
  );
}
