import Link from "next/link";
import { FormBrandHeader } from "@/components/forms/submission/FormBrandHeader";
import { getPublicPageSummaries } from "@/lib/public-view";
import { testSmartsheetConnection } from "@/lib/smartsheet";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [pages, connectionOk] = await Promise.all([
    getPublicPageSummaries(),
    testSmartsheetConnection(),
  ]);

  return (
    <main className="min-h-screen bg-[color:var(--wsu-stone,#f7f5f2)]">
      <FormBrandHeader maxWidthClassName="max-w-6xl" />
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
        <section className="rounded-[1.75rem] border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] shadow-[0_16px_48px_rgba(35,31,32,0.06)]">
          <div className="flex flex-col gap-8 p-6 sm:p-8 lg:flex-row lg:items-stretch lg:gap-10 lg:p-10">
            <div className="min-w-0 flex-1 space-y-4">
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-[color:var(--wsu-muted)]">Smartsheet View</p>
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-[color:var(--wsu-ink)] sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
                Self-service public views for live Smartsheet data
              </h1>
              <p className="max-w-2xl text-base leading-7 text-[color:var(--wsu-muted)]">
                Public pages render server-side from your sheets. The admin area configures sources, fields, layouts, contributors, and publishing.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  href="/admin"
                  className="btn-crimson inline-flex items-center rounded-full bg-[color:var(--wsu-crimson)] px-4 py-2 text-sm font-medium transition hover:bg-[color:var(--wsu-crimson-dark)]"
                >
                  Open admin
                </Link>
                <Link
                  href="/instructions/admin"
                  className="inline-flex items-center rounded-full border border-[color:var(--wsu-crimson)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--wsu-crimson)] transition hover:bg-[color:var(--wsu-crimson)]/8"
                >
                  Admin guide
                </Link>
              </div>
            </div>
            <aside className="flex w-full flex-col justify-between gap-4 rounded-2xl border border-[color:var(--wsu-border)] bg-[linear-gradient(180deg,rgba(166,15,45,0.06),rgba(255,255,255,0.92))] p-5 lg:max-w-sm lg:shrink-0">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-crimson)]">Connection</p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--wsu-muted)]">
                  Uses <code className="font-mono text-[color:var(--wsu-ink)]">SMARTSHEET_API_TOKEN</code> or{" "}
                  <code className="font-mono text-[color:var(--wsu-ink)]">SMARTSHEET_CONNECTIONS_JSON</code> on the server.
                </p>
              </div>
              <p
                className={`rounded-xl border px-3 py-2.5 text-sm ${connectionOk ? "border-emerald-200 bg-emerald-50/90 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-950"}`}
              >
                {connectionOk ? "Smartsheet API reachable." : "Smartsheet unreachable — check token and deployment env."}
              </p>
            </aside>
          </div>
        </section>

        <section className="space-y-5">
          <header className="max-w-3xl space-y-1">
            <h2 className="text-xl font-semibold text-[color:var(--wsu-ink)] sm:text-2xl">Public pages</h2>
            <p className="text-sm text-[color:var(--wsu-muted)]">Published slugs from your config. Each slug can host one or more views.</p>
          </header>

          {pages.length === 0 ? (
            <p className="text-sm text-[color:var(--wsu-muted)]">No public pages configured yet. Create a view and publish it from the admin.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {pages.map((page) => (
                <li
                  key={page.slug}
                  className="flex flex-col gap-4 rounded-2xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-crimson)]">{page.sourceLabel}</p>
                    <h3 className="mt-1.5 text-lg font-semibold text-[color:var(--wsu-ink)] sm:text-xl">{page.title}</h3>
                    <div className="mt-3 flex flex-wrap gap-1.5" aria-label={`Views on this page: ${page.views.map((v) => v.label).join(", ")}`}>
                      {page.views.map((view) => (
                        <span
                          key={view.id}
                          className="rounded-full border border-[color:var(--wsu-border)] bg-white px-2.5 py-0.5 text-xs font-medium text-[color:var(--wsu-muted)]"
                        >
                          {view.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Link
                    href={`/view/${page.slug}`}
                    className="btn-crimson inline-flex shrink-0 items-center justify-center rounded-full bg-[color:var(--wsu-crimson)] px-4 py-2 text-sm font-medium transition hover:bg-[color:var(--wsu-crimson-dark)] sm:self-center"
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
