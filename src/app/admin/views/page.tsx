import Link from "next/link";
import {
  AdminDataTable,
  resolveAdminTablePage,
} from "@/components/admin/AdminDataTable";
import {
  VIEWS_LIST_TOUR_STEPS,
  VIEWS_LIST_TOUR_STORAGE_KEY,
} from "@/components/admin/tours/views-list-tour";
import { Button, EmptyState } from "@/components/admin/WorkspacePrimitives";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProductTourControls } from "@/components/ui/ProductTourHost";
import { requireAdminPageAccess } from "@/lib/admin-page";
import { listSourceConfigs, listViewConfigs } from "@/lib/config/store";
import { publicInteractiveHref } from "@/lib/public-view-href";

export default async function ViewsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sourceId?: string }>;
}) {
  await requireAdminPageAccess("/admin/views");
  const [sources, views] = await Promise.all([listSourceConfigs(), listViewConfigs()]);
  const sourceMap = new Map(sources.map((source) => [source.id, source.label]));
  const uniquePublicSlug = (slug: string) =>
    views.filter((view) => view.public && view.slug === slug).length === 1;

  const params = await searchParams;
  const sourceFilter = params.sourceId?.trim() ?? "";
  const filteredViews = sourceFilter
    ? views.filter((view) => view.sourceId === sourceFilter)
    : views;
  const page = resolveAdminTablePage(params.page, filteredViews.length);
  const sourceFilterLabel = sourceFilter
    ? sourceMap.get(sourceFilter) ?? sourceFilter
    : null;
  const viewsBasePath = sourceFilter
    ? `/admin/views?sourceId=${encodeURIComponent(sourceFilter)}`
    : "/admin/views";

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Admin builder"
        title="Views"
        description={
          sourceFilterLabel
            ? `Views for source “${sourceFilterLabel}”. Preview before you publish.`
            : "Editable definitions that map source fields to a public route. Preview before you publish."
        }
        dataTour="av-heading"
        actions={
          <>
            <ProductTourControls storageKey={VIEWS_LIST_TOUR_STORAGE_KEY} steps={VIEWS_LIST_TOUR_STEPS} />
            {sourceFilter ? (
              <Link href="/admin/views">
                <Button>All views</Button>
              </Link>
            ) : null}
            <span data-tour="av-new">
              <Link href="/admin/views/new">
                <Button variant="primary">New view</Button>
              </Link>
            </span>
          </>
        }
      />
      <div data-tour="av-table">
        <AdminDataTable
          headers={["View", "Source", "Route", "Status"]}
          items={filteredViews}
          page={page}
          basePath={viewsBasePath}
          getRowKey={(view) => view.id}
          empty={
            <EmptyState
              icon={<span className="font-serif text-lg">▦</span>}
              title={sourceFilter ? "No views for this source" : "No views yet"}
              description={
                sourceFilter
                  ? "Create a view from this source, or clear the filter to see all views."
                  : "A view starts from a source. Register a source first, then choose the fields to expose."
              }
              action={{
                href: sourceFilter ? "/admin/views" : "/admin/sources",
                label: sourceFilter ? "Show all views" : "Go to sources",
              }}
              variant="panel"
            />
          }
          renderRow={(view) => (
            <>
              <div className="min-w-0">
                <Link href={`/admin/views/${view.id}`} className="font-medium text-ink hover:text-crimson">
                  {view.label}
                </Link>
                <p className="mt-1 text-xs text-sub">{view.layout}</p>
              </div>
              <p className="min-w-0 text-sm text-sub">{sourceMap.get(view.sourceId) ?? view.sourceId}</p>
              <code className="min-w-0 truncate text-xs text-sub">
                {publicInteractiveHref(view.slug, view.id, uniquePublicSlug(view.slug))}
              </code>
              <div className="flex flex-wrap items-center gap-2" data-tour="av-status">
                <span className="font-mono text-xs uppercase tracking-wide text-crimson">
                  {view.public ? "Published" : "Draft"}
                </span>
                <Link
                  href={`/admin/views/${view.id}/preview`}
                  className="text-xs font-medium text-crimson hover:underline"
                >
                  Preview
                </Link>
              </div>
            </>
          )}
        />
      </div>
    </section>
  );
}
