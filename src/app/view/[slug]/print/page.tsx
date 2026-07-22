import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DisplayTimezoneProvider } from "@/components/views/shared/DisplayTimezoneContext";
import { PrintViewDocument, buildPrintColumnPickerOptions } from "@/components/views/print/PrintViewDocument";
import {
  loadPublicPageState,
  resolveRequestedResolvedView,
  resolveRequestedViewConfig,
} from "@/lib/public-view";
import { omitRecordSuppressedRowsFromResolvedView } from "@/lib/record-suppression";
import { humanizeSlug } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const requestedView = firstValue(sp.view);

  let title = `${humanizeSlug(slug)} — Print`;
  try {
    const page = await loadPublicPageState(slug);
    if (page) {
      const view = resolveRequestedResolvedView(page.resolvedViews, page.defaultViewId, requestedView);
      if (view) {
        title = `${page.title}: ${view.label} — Print`;
      }
    }
  } catch {
    /* keep fallback title */
  }

  return {
    title,
    robots: { index: false, follow: false },
    description: "Print-friendly export of this public data view (browser print / save as PDF).",
  };
}

export default async function PrintExportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const requestedView = firstValue(resolvedSearchParams.view);

  let page;
  try {
    page = await loadPublicPageState(slug);
  } catch (error) {
    console.error(`[smartsheets_view] Failed to load print page "${slug}":`, error);
    return (
      <main className="flex min-h-screen items-center justify-center bg-[color:var(--wsu-stone)] px-4 text-center">
        <div className="max-w-md space-y-4 rounded-3xl border border-[color:var(--wsu-border)] bg-white p-8 shadow-xl">
          <h1 className="text-2xl font-bold text-[color:var(--wsu-crimson)]">Unable to load print view</h1>
          <p className="text-sm text-[color:var(--wsu-muted)]">
            The data source may be unavailable. Try again from the interactive view.
          </p>
          <Link href={`/view/${slug}`} className="inline-block rounded-full bg-[color:var(--wsu-crimson)] px-6 py-2 text-sm font-medium text-white">
            Open view
          </Link>
        </div>
      </main>
    );
  }

  if (!page) {
    notFound();
  }

  const activeView = resolveRequestedResolvedView(page.resolvedViews, page.defaultViewId, requestedView);
  const activeViewConfig = resolveRequestedViewConfig(page.viewConfigs, requestedView);

  if (!activeView || !activeViewConfig) {
    notFound();
  }

  const colsParam = firstValue(resolvedSearchParams.cols);
  const printColumnKeys = colsParam
    ? colsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;
  const printCompact = firstValue(resolvedSearchParams.compact) === "1";
  const printTableLayout = firstValue(resolvedSearchParams.layout) === "wide" ? "wide" : "sections";
  const printView = omitRecordSuppressedRowsFromResolvedView(activeView);
  const printableColumnOptions = buildPrintColumnPickerOptions(printView);
  const singlePublishedView = page.viewConfigs.length === 1;

  return (
    <div className="min-h-screen bg-[color:var(--wsu-stone)] px-4 py-6 sm:px-6">
      <DisplayTimezoneProvider timeZone={printView.displayTimeZone}>
        <Suspense fallback={<PrintExportFallback />}>
          <PrintViewDocument
            slug={slug}
            viewId={printView.id}
            singlePublishedView={singlePublishedView}
            pageTitle={page.title}
            sourceLabel={page.sourceConfig.label}
            sourceName={page.sourceName}
            fetchedAt={page.fetchedAt}
            view={printView}
            printColumnKeys={printColumnKeys && printColumnKeys.length > 0 ? printColumnKeys : undefined}
            printCompact={printCompact}
            printTableLayout={printTableLayout}
            printableColumnOptions={printableColumnOptions}
          />
        </Suspense>
      </DisplayTimezoneProvider>
    </div>
  );
}

function PrintExportFallback() {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-[color:var(--wsu-border)] bg-white p-8 text-center text-sm text-[color:var(--wsu-muted)]">
      Loading print layout…
    </div>
  );
}
