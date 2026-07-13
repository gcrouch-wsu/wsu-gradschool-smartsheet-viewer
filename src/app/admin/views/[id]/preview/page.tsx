import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicViewRenderer, formatLayoutLabel } from "@/components/public/ViewRenderer";
import { requireAdminPageAccess } from "@/lib/admin-page";
import { LAYOUT_OPTIONS } from "@/lib/config/options";
import type { LayoutType } from "@/lib/config/types";
import { getPublicViewsBySlug } from "@/lib/config/store";
import { loadAdminViewPreview } from "@/lib/public-view";
import { publicInteractiveHref } from "@/lib/public-view-href";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ViewPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  await requireAdminPageAccess(`/admin/views/${id}/preview`);
  const resolvedSearchParams = await searchParams;
  const preview = await loadAdminViewPreview(id);

  if (!preview) {
    notFound();
  }

  const publishedForSlug = await getPublicViewsBySlug(preview.viewConfig.slug);
  const singlePublishedView = publishedForSlug.length === 1;
  const publicPageHref = publicInteractiveHref(
    preview.viewConfig.slug,
    preview.viewConfig.id,
    singlePublishedView,
  );

  const requestedLayout = firstValue(resolvedSearchParams.layout);
  const layout = LAYOUT_OPTIONS.includes(requestedLayout as LayoutType)
    ? (requestedLayout as LayoutType)
    : preview.resolvedView.layout;

  return (
    <div className="space-y-5">
      <section className="rounded-[18px] border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-crimson">Preview</p>
            <h2 className="mt-1 font-serif text-2xl font-medium text-ink">{preview.viewConfig.label}</h2>
            <p className="mt-2 text-[13px] text-sub">
              Live preview from {preview.sourceConfig.label} ({preview.sourceName}) with {preview.resolvedView.rowCount} resolved rows.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/views/${preview.viewConfig.id}`} className="rounded-full border border-line-strong bg-white px-4 py-2 text-[13.5px] font-medium text-ink hover:bg-[#faf7f8]">Back to builder</Link>
            {preview.viewConfig.public && (
              <Link href={publicPageHref} className="rounded-full bg-crimson px-4 py-2 text-[13.5px] font-medium text-white hover:bg-[var(--crimson-deep)]">Open public page</Link>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-line bg-[#fbf9fa] p-4 text-[13px] text-sub">
          <p><span className="font-medium text-ink">Fetched:</span> {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(preview.fetchedAt))}</p>
          <p className="mt-1"><span className="font-medium text-ink">Layout:</span> {formatLayoutLabel(layout)}</p>
          <p className="mt-1"><span className="font-medium text-ink">Publication:</span> {preview.viewConfig.public ? "Published" : "Draft"}</p>
        </div>

        {preview.schemaWarnings.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">Schema drift warnings</p>
            <ul className="mt-2 space-y-1">
              {preview.schemaWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {LAYOUT_OPTIONS.map((option) => (
            <Link
              key={option}
              href={`/admin/views/${preview.viewConfig.id}/preview?layout=${option}`}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                option === layout
                  ? "border-crimson bg-crimson text-white"
                  : "border-line-strong bg-white text-sub hover:border-[var(--crimson-line)] hover:text-crimson"
              }`}
            >
              {formatLayoutLabel(option)}
            </Link>
          ))}
        </div>
        <PublicViewRenderer layout={layout} view={preview.resolvedView} />
      </section>
    </div>
  );
}