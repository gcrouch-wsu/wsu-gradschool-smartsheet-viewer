import Link from "next/link";
import { FormBrandHeader } from "@/components/forms/submission/FormBrandHeader";
import { getPublicPageSummaries } from "@/lib/public-view";
import { testSmartsheetConnection } from "@/lib/smartsheet";

export const dynamic = "force-dynamic";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crimson";

const headerActionClass = [
  "inline-flex min-h-11 items-center justify-center rounded-full px-3.5 py-2 text-sm font-medium transition",
  focusRing,
].join(" ");

export default async function HomePage() {
  const [pages, connectionOk] = await Promise.all([
    getPublicPageSummaries(),
    testSmartsheetConnection(),
  ]);

  return (
    <div className="bg-canvas min-h-screen">
      <a
        href="#main-content"
        className={[
          "sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50",
          "focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ink",
          "focus:shadow-[var(--shadow-md)]",
          focusRing,
        ].join(" ")}
      >
        Skip to main content
      </a>

      <FormBrandHeader
        maxWidthClassName="max-w-[1200px]"
        actionsLabel="Workspace administration"
        actions={
          <>
            <Link
              href="/instructions/admin"
              className={`${headerActionClass} border border-[var(--crimson-line)] bg-white text-crimson hover:bg-[var(--crimson-soft)]`}
            >
              Admin guide
            </Link>
            <Link
              href="/admin"
              className={`${headerActionClass} border border-crimson bg-crimson text-white shadow-[0_2px_6px_rgba(152,30,50,0.24)] hover:bg-[var(--crimson-deep)]`}
            >
              Open admin
            </Link>
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
                      focusRing,
                    ].join(" ")}
                  >
                    Open admin
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
