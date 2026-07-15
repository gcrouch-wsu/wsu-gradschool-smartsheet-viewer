import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ContributorLoginForm } from "@/components/views/contributor/ContributorLoginForm";
import { ViewStyleWrapper } from "@/components/views/shell/ViewStyleWrapper";
import {
  CONTRIBUTOR_SESSION_COOKIE_NAME,
  getContributorConfigurationError,
  readContributorSessionToken,
} from "@/lib/contributor-auth";
import {
  loadPublicPageState,
  resolveRequestedResolvedView,
  resolveRequestedViewConfig,
} from "@/lib/public-view";
import { publicInteractiveHref } from "@/lib/public-view-href";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ContributorLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const requestedView = firstValue(resolvedSearchParams.view);
  const configurationError = getContributorConfigurationError();

  const page = await loadPublicPageState(slug, { datasetOptions: { fresh: true } });
  if (!page) {
    redirect("/");
  }

  const activeView = resolveRequestedResolvedView(page.resolvedViews, page.defaultViewId, requestedView);
  const activeViewConfig = resolveRequestedViewConfig(page.viewConfigs, requestedView);
  if (!activeView || !activeViewConfig) {
    redirect(`/view/${slug}`);
  }

  const singlePublishedView = page.viewConfigs.length === 1;
  const returnHref = publicInteractiveHref(slug, activeView.id, singlePublishedView);

  if (configurationError || !activeViewConfig.editing?.enabled) {
    return (
      <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] p-8 shadow-[0_24px_64px_rgba(35,31,32,0.07)]">
          <h1 className="text-3xl font-semibold text-[color:var(--wsu-ink)]">Contributor editing unavailable</h1>
          <p className="mt-3 text-sm text-[color:var(--wsu-muted)]">
            {configurationError ?? "Editing is not enabled for this view."}
          </p>
          <Link
            href={returnHref}
            className="link-pill-muted mt-6"
          >
            Return to view
          </Link>
        </div>
      </main>
    );
  }

  const cookieStore = await cookies();
  const session = await readContributorSessionToken(cookieStore.get(CONTRIBUTOR_SESSION_COOKIE_NAME)?.value);
  if (session.ok && session.payload) {
    redirect(returnHref);
  }

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <ViewStyleWrapper style={activeView.style} themePresetId={activeView.themePresetId}>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
            <section className="view-header-panel p-8">
              <p className="view-header-source-label">{page.sourceConfig.label}</p>
              <h1 className="view-header-page-title mt-3">Contributor access</h1>
              <p className="mt-4 text-sm leading-7 text-[color:var(--wsu-muted)]">
                Sign in to update your assigned rows in <span className="font-medium text-[color:var(--wsu-ink)]">{activeView.label}</span>.
              </p>
              <div className="mt-8 rounded-[1.5rem] border border-[color:var(--wsu-border)] bg-white p-5">
                <p className="text-sm font-semibold text-[color:var(--wsu-ink)]">Before you continue</p>
                <ul className="mt-3 space-y-2 text-sm text-[color:var(--wsu-muted)]">
                  <li>
                    Use your <code className="rounded bg-[color:var(--wsu-stone)]/40 px-1.5 py-0.5 text-xs">@wsu.edu</code> email address.
                  </li>
                  <li>You can create an account only if that WSU email appears on the Smartsheet row in the configured contact field.</li>
                  <li>
                    If your email is not listed, contact{" "}
                    <a
                      href="mailto:gradschool@wsu.edu"
                      className="font-medium text-[color:var(--wsu-crimson)] underline underline-offset-2"
                    >
                      gradschool@wsu.edu
                    </a>
                    .
                  </li>
                  <li>Choose <strong className="text-[color:var(--wsu-ink)]">First-time access</strong> only the first time you set your contributor password.</li>
                </ul>
                <Link
                  href="/instructions/contributor"
                  className="link-pill mt-4"
                >
                  Read contributor instructions
                </Link>
              </div>
            </section>

            <section className="rounded-[2rem] border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] p-8 shadow-[0_24px_64px_rgba(35,31,32,0.07)]">
              <ContributorLoginForm slug={slug} viewId={activeView.id} returnHref={returnHref} />
              <Link
                href={returnHref}
                className="link-pill-muted mt-6"
              >
                Back to view
              </Link>
            </section>
          </div>
        </ViewStyleWrapper>
      </div>
    </main>
  );
}
