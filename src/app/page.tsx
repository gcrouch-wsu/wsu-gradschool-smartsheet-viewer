import Link from "next/link";
import { HeaderIconLink, HeaderLogoutLink, HeaderSignedInIdentity } from "@/components/auth/HeaderLogoutLink";
import { AppBrandHeader } from "@/components/layout/AppBrandHeader";
import { DatabaseUnavailable } from "@/components/DatabaseUnavailable";
import type { PublicPageSummary } from "@/lib/config/types";
import { isDatabaseUnavailableError } from "@/lib/database-unavailable";
import { resolveContributorPrincipal } from "@/lib/identity";
import { getPublicPageSummaries } from "@/lib/public-view";
import { testSmartsheetConnection } from "@/lib/smartsheet";

export const dynamic = "force-dynamic";

function StudentPortalIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 10L12 5 2 10l10 5 10-5z" />
      <path d="M6 12.5v4.2c0 .6 2.7 2.3 6 2.3s6-1.7 6-2.3v-4.2" />
      <path d="M22 10v6" />
    </svg>
  );
}

function AdminGuideIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h5" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
      <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
    </svg>
  );
}

function isContributorOnlySession(principal: Awaited<ReturnType<typeof resolveContributorPrincipal>>) {
  if (!principal?.capabilities.includes("contributor.edit")) return false;
  return !principal.capabilities.some((capability) =>
    ["admin.manage", "admin.owner", "forms.admin", "forms.approver", "forms.coordinator", "forms.student"].includes(
      capability,
    ),
  );
}

export default async function HomePage() {
  let pages: PublicPageSummary[];
  let connectionOk: boolean;
  try {
    [pages, connectionOk] = await Promise.all([
      getPublicPageSummaries(),
      testSmartsheetConnection(),
    ]);
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return <DatabaseUnavailable />;
    }
    throw error;
  }

  const contributor = await resolveContributorPrincipal();
  const contributorSession = isContributorOnlySession(contributor) ? contributor : null;
  const contributorName =
    contributorSession?.displayName?.trim() ||
    contributorSession?.email ||
    contributorSession?.identifier ||
    null;

  return (
    <div className="bg-canvas min-h-screen">
      <a
        href="#main-content"
        className={[
          "sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50",
          "focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ink",
          "focus:shadow-[var(--shadow-md)]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crimson",
        ].join(" ")}
      >
        Skip to main content
      </a>

      <AppBrandHeader
        actionsLabel="Workspace administration"
        actions={
          <>
            {contributorSession && contributorName ? (
              <HeaderSignedInIdentity
                name={contributorName}
                email={contributorSession.email}
                detail="Contributor"
              />
            ) : null}
            <HeaderIconLink href="/student" label="Student portal">
              <StudentPortalIcon />
            </HeaderIconLink>
            <HeaderIconLink href="/instructions/admin" label="Admin guide">
              <AdminGuideIcon />
            </HeaderIconLink>
            <HeaderIconLink href="/admin" label="Admin">
              <AdminIcon />
            </HeaderIconLink>
            {contributorSession ? <HeaderLogoutLink href="/api/auth/okta/logout?next=/" /> : null}
          </>
        }
      />

      <main id="main-content" tabIndex={-1} className="px-4 py-6 sm:px-7 sm:py-10 lg:px-8 lg:pb-16">
        <div className="mx-auto max-w-[1200px]">
          <div className="overflow-hidden rounded-[22px] border border-line bg-surface shadow-[var(--shadow-md)]">
            <header className="border-b border-line px-5 py-6 sm:px-8 sm:py-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-crimson">
                    Washington State University
                  </p>
                  <h1 className="mt-1 font-serif text-[28px] font-medium leading-tight tracking-[-0.02em] text-ink sm:text-[32px]">
                    Self-service Smartsheet Workspace
                  </h1>
                  <p className="mt-2 max-w-[58ch] text-sm leading-6 text-sub">
                    Browse published public pages powered by live Smartsheet data. The admin area configures
                    sources, fields, layouts, contributors, and publishing.
                  </p>
                </div>
                <p
                  role="status"
                  className={[
                    "inline-flex w-fit shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium",
                    connectionOk
                      ? "border-emerald-700/30 bg-emerald-50 text-emerald-950"
                      : "border-amber-800/30 bg-amber-50 text-amber-950",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "h-2 w-2 shrink-0 rounded-full",
                      connectionOk ? "bg-emerald-700" : "bg-amber-800",
                    ].join(" ")}
                    aria-hidden
                  />
                  {connectionOk ? "Smartsheet API reachable" : "Smartsheet API unreachable"}
                </p>
              </div>
            </header>

            <section className="p-5 sm:p-7" aria-labelledby="public-pages-heading">
              <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 id="public-pages-heading" className="text-lg font-semibold text-ink sm:text-xl">
                    Public pages
                  </h2>
                  <p id="public-pages-desc" className="mt-1 text-sm leading-6 text-sub">
                    Published views available to anyone with the link.
                  </p>
                </div>
                {pages.length > 0 ? (
                  <p className="text-sm font-medium text-sub" aria-live="polite">
                    {pages.length} page{pages.length === 1 ? "" : "s"}
                  </p>
                ) : null}
              </div>

              {pages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line-strong bg-[#fdfbfc] px-5 py-12 text-center">
                  <h3 className="font-serif text-lg font-medium text-ink">No public pages yet</h3>
                  <p className="mx-auto mt-1 max-w-[36ch] text-sm leading-6 text-sub">
                    Publish a view from the admin workspace to list it here.
                  </p>
                  <Link
                    href="/admin"
                    className={[
                      "mt-4 inline-flex min-h-11 items-center justify-center gap-1 rounded-full px-4 text-sm font-medium text-crimson underline-offset-2 hover:underline",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crimson",
                    ].join(" ")}
                  >
                    Admin
                  </Link>
                </div>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2" aria-describedby="public-pages-desc">
                  {pages.map((page) => {
                    const titleId = `public-page-title-${page.slug}`;
                    const metaId = `public-page-meta-${page.slug}`;
                    const viewsLabel =
                      page.views.length > 0
                        ? `Includes views: ${page.views.map((view) => view.label).join(", ")}`
                        : undefined;

                    return (
                      <li key={page.slug}>
                        <Link
                          href={`/view/${page.slug}`}
                          aria-labelledby={titleId}
                          aria-describedby={metaId}
                          className={[
                            "group flex h-full min-h-11 items-center justify-between gap-4 rounded-[14px] border border-line bg-surface px-5 py-4 transition",
                            "hover:border-[var(--crimson-line)] hover:shadow-[var(--shadow-sm)]",
                            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crimson",
                          ].join(" ")}
                        >
                          <div className="min-w-0 flex-1">
                            <p id={metaId} className="text-xs font-medium uppercase tracking-[0.12em] text-crimson">
                              {page.sourceLabel}
                              {viewsLabel ? <span className="sr-only">. {viewsLabel}</span> : null}
                            </p>
                            <h3 id={titleId} className="mt-1.5 text-base font-semibold text-ink group-hover:text-crimson">
                              {page.title}
                            </h3>
                            {page.views.length > 0 ? (
                              <ul className="mt-3 flex flex-wrap gap-1.5" aria-hidden>
                                {page.views.map((view) => (
                                  <li
                                    key={view.id}
                                    className="rounded-full border border-line-strong bg-[#fbf9fa] px-2.5 py-1 text-xs font-medium text-sub"
                                  >
                                    {view.label}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                          <span className="shrink-0 text-sm font-semibold text-crimson" aria-hidden>
                            Open →
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
