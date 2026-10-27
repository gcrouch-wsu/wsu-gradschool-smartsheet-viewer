import Link from "next/link";
import { cookies, headers } from "next/headers";
import { HeaderIconLink, HeaderLogoutLink, HeaderSignedInIdentity } from "@/components/auth/HeaderLogoutLink";
import { AppBrandHeader } from "@/components/layout/AppBrandHeader";
import { notFound } from "next/navigation";
import { ToastProvider } from "@/components/ui/Toast";
import { EmbedHeightReporter } from "@/components/views/shell/EmbedHeightReporter";
import { PublicHeaderBrandStrip } from "@/components/views/shell/PublicHeaderBrandStrip";
import { ViewStyleWrapper } from "@/components/views/shell/ViewStyleWrapper";
import { ViewWithSearchAndIndex } from "@/components/views/layouts/ViewWithSearchAndIndex";
import { PublicLayoutSwitcher } from "@/components/views/shell/PublicLayoutSwitcher";
import { ViewTabs } from "@/components/views/shell/ViewTabs";
import { PublicViewTourHost } from "@/components/views/shell/PublicViewTourHost";
import { LAYOUT_OPTIONS, formatLayoutLabel } from "@/lib/config/options";
import type { LayoutType } from "@/lib/config/types";
import { mergeThemeTokens } from "@/lib/config/themes";
import { ADMIN_SESSION_COOKIE_NAME } from "@/lib/admin-auth";
import { resolveAdminPrincipalFromSession } from "@/lib/admin-users";
import {
  getContributorConfigurationError,
} from "@/lib/contributor-auth";
import { resolveContributorPrincipal } from "@/lib/identity";
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

/** Treat "Test - Graduate Leave (rou)" and "Test Graduate Leave Rou" as the same heading. */
function sameHeading(a?: string | null, b?: string | null) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!a?.trim() || !b?.trim()) return false;
  return normalize(a) === normalize(b);
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

  const mainClassName = embed
    ? "bg-transparent px-0 py-0"
    : "view-page min-h-screen px-3 py-5 sm:px-6 sm:py-8 lg:px-8";
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
    <PublicLayoutSwitcher
      layout={layout}
      options={LAYOUT_OPTIONS.map((option) => ({
        id: option,
        label: formatLayoutLabel(option),
        href: publicInteractiveHref(slug, activeView.id, singlePublishedView, { layout: option, embed }),
      }))}
    />
  ) : null;

  let contributorEmail: string | null = null;
  let contributorDisplayName: string | null = null;
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
      const contributor = await resolveContributorPrincipal();
      const email = contributor?.email ?? null;
      if (email) {
        const dataset = await loadContributorDataset(page.sourceConfig, CONTRIBUTOR_DATASET_OPTIONS);
        if (isContributorStillInSheet(dataset.rows, email, activeViewConfig.editing!.contactColumnIds)) {
          contributorEmail = email;
          contributorDisplayName = (contributor?.displayName ?? email).trim() || email;
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

  const contributorLogoutHref = `/api/auth/okta/logout?next=${encodeURIComponent(`/view/${slug}`)}`;
  const headerIdentityName =
    contributorDisplayName || contributorEmail || (adminUnrestrictedEditing ? adminEditingLabel : null);

  return (
    <>
    {!embed ? (
      <AppBrandHeader
        maxWidthClassName="max-w-7xl"
        actionsLabel="Account"
        actions={
          loginHref || printHref || exportCsvHref || contributorInstructionsHref || showPublicEditingChrome || contributorEmail ? (
            <>
              {headerIdentityName ? (
                <HeaderSignedInIdentity
                  name={headerIdentityName}
                  email={contributorEmail}
                  detail={adminUnrestrictedEditing ? "Administrator" : "Contributor"}
                />
              ) : null}
              <div className="flex flex-wrap items-center justify-end gap-2">
              {!showPublicEditingChrome && loginHref ? (
                <span data-tour="pv-signin" className="inline-flex">
                <HeaderIconLink href={loginHref} label="Contributor sign in">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
                    <path d="M10 17l5-5-5-5M15 12H3" />
                  </svg>
                </HeaderIconLink>
                </span>
              ) : null}
              {printHref ? (
                <span data-tour="pv-print" className="inline-flex">
                <HeaderIconLink href={printHref} label="Print / PDF">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M6 9V3h12v6" />
                    <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                    <path d="M6 14h12v7H6z" />
                  </svg>
                </HeaderIconLink>
                </span>
              ) : null}
              <PublicViewTourHost icon />
              {exportCsvHref ? (
                <span data-tour="pv-export" className="inline-flex">
                <HeaderIconLink href={exportCsvHref} label="Export CSV">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 3v12" />
                    <path d="M7 10l5 5 5-5" />
                    <path d="M5 21h14" />
                  </svg>
                </HeaderIconLink>
                </span>
              ) : null}
              {contributorInstructionsHref ? (
                <span data-tour="pv-instructions" className="inline-flex">
                <HeaderIconLink href={contributorInstructionsHref} label="Contributor instructions" newWindow>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <path d="M14 2v6h6M8 13h8M8 17h5" />
                  </svg>
                </HeaderIconLink>
                </span>
              ) : null}
              </div>
              {contributorEmail ? <HeaderLogoutLink href={contributorLogoutHref} /> : null}
            </>
          ) : undefined
        }
      />
    ) : null}
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
            <header className="view-header-panel px-4 py-5 sm:px-7 sm:py-7">
              <div className="flex flex-wrap items-start justify-between gap-5 lg:gap-10">
                <div className="min-w-0 flex-1 space-y-2">
                  <PublicHeaderBrandStrip presentation={activeView.presentation} />
                  {!activeView.presentation?.hideHeaderBackLink &&
                    (showPublicEditingChrome ? (
                      <p>
                        <Link href="/" className="view-header-back">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M15 6l-6 6 6 6" />
                          </svg>
                          All views
                        </Link>
                        {adminUnrestrictedEditing ? (
                          <span className="mt-1 block text-xs text-[color:var(--wsu-muted)]">
                            End your admin session from the{" "}
                            <strong className="font-medium text-[color:var(--wsu-ink)]">Admin</strong> area. Browser
                            Back may leave this site—use this link to return to the catalog.
                          </span>
                        ) : null}
                      </p>
                    ) : (
                      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-1.5">
                        <Link href="/" className="view-header-back">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M15 6l-6 6 6 6" />
                          </svg>
                          All views
                        </Link>
                        {!activeView.presentation?.hideHeaderSourceLabel &&
                        !sameHeading(page.sourceConfig.label, page.title) ? (
                          <>
                            <span className="text-[color:var(--wsu-border)]" aria-hidden>
                              /
                            </span>
                            <span className="view-header-source-label">{page.sourceConfig.label}</span>
                          </>
                        ) : null}
                      </nav>
                    ))}
                  <div data-tour="pv-heading">
                    {(!activeView.presentation?.hideHeaderBackLink && !showPublicEditingChrome) ||
                    activeView.presentation?.hideHeaderSourceLabel ||
                    (!activeView.presentation?.hideHeaderPageTitle &&
                      sameHeading(page.sourceConfig.label, page.title))
                      ? null
                      : (
                          <p className="view-header-source-label">{page.sourceConfig.label}</p>
                        )}
                    {!activeView.presentation?.hideHeaderPageTitle && (
                      <h1 className="view-header-page-title mt-1 text-balance">{page.title}</h1>
                    )}
                    {!activeView.presentation?.hideViewTitleSection &&
                      (!sameHeading(activeView.label, page.title) || activeView.description) && (
                        <div className="mt-2.5 max-w-3xl">
                          {!sameHeading(activeView.label, page.title) ? (
                            <p className="view-section-title text-[1.125rem] leading-snug text-[color:var(--wsu-ink)]">
                              {activeView.label}
                            </p>
                          ) : null}
                          {activeView.description ? (
                            <p
                              className={`text-sm leading-relaxed text-[color:var(--wsu-muted)] ${
                                !sameHeading(activeView.label, page.title) ? "mt-0.5" : ""
                              }`}
                            >
                              {activeView.description}
                            </p>
                          ) : null}
                        </div>
                      )}
                    {!activeView.presentation?.hideHeaderLiveDataText &&
                    !(
                      (!activeView.presentation?.hideHeaderPageTitle &&
                        sameHeading(page.sourceName, page.title)) ||
                      sameHeading(page.sourceName, activeView.label)
                    ) && (
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
                    !activeView.presentation?.hideHeaderRefreshed)) ||
                  layoutSwitcher) && (
                  <div className="w-full min-w-0 sm:min-w-[16rem] sm:max-w-[36rem] sm:flex-1">
                    <div className="view-surface-muted rounded-xl border border-[color:var(--wsu-border)] px-3.5 py-3 text-sm text-[color:var(--wsu-muted)]">
                      {!activeView.presentation?.hideHeaderInfoBox &&
                      !activeView.presentation?.hideHeaderActiveView &&
                      !showViewTabs &&
                      (activeView.presentation?.hideViewTitleSection ||
                        (activeView.label === page.title && !activeView.description)) ? (
                        <dl className="view-header-meta mb-2">
                          <div className="meta-row">
                            <dt>View</dt>
                            <dd> {activeView.label}</dd>
                          </div>
                        </dl>
                      ) : null}

                      <div className="flex items-center justify-between gap-3">
                        {layoutSwitcher ? (
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--wsu-muted)]">
                            Layout
                          </p>
                        ) : (
                          <span />
                        )}
                        {!activeView.presentation?.hideHeaderInfoBox &&
                        !activeView.presentation?.hideHeaderRefreshed ? (
                          <p className="view-header-meta shrink-0 text-right">
                            <span className="font-semibold text-[color:var(--wsu-ink)]">Refreshed</span>{" "}
                            <time dateTime={page.fetchedAt} className="tabular-nums">
                              {formatFetchedAtInViewTimeZone(page.fetchedAt, activeView.displayTimeZone)}
                            </time>
                          </p>
                        ) : null}
                      </div>
                      {layoutSwitcher ? <div className="mt-1.5 min-w-0">{layoutSwitcher}</div> : null}
                    </div>
                  </div>
                )}
              </div>
            </header>
            </div>
          )}

          <section id="main-view-content" className={embed ? "space-y-3 scroll-mt-4" : "space-y-4 scroll-mt-4"}>
            {showViewTabs && (
              <div data-tour="pv-view-tabs">
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
              </div>
            )}

            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                {activeView.presentation?.hideHeader &&
                  !activeView.presentation?.hideViewTitleSection &&
                  (!sameHeading(activeView.label, page.title) || activeView.description) && (
                  <>
                    {!sameHeading(activeView.label, page.title) ? (
                      <h2 className="view-section-title text-[1.25rem] leading-snug">{activeView.label}</h2>
                    ) : null}
                    {activeView.description && (
                      <p className="mt-0.5 max-w-3xl text-sm text-[color:var(--wsu-muted)]">{activeView.description}</p>
                    )}
                  </>
                )}
              </div>
              {activeView.presentation?.hideHeader ? <div className="flex min-w-0 w-full items-center">{layoutSwitcher}</div> : null}
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
                contributorRowsFiltered={Boolean(contributorEmail && editableRowIds.length > 0)}
              />
            </ToastProvider>
          </section>
        </ViewStyleWrapper>
      </div>
    </main>
    </>
  );
}
