import Link from "next/link";
import {
  AdminDataTable,
  resolveAdminTablePage,
} from "@/components/admin/AdminDataTable";
import { Button, EmptyState } from "@/components/admin/WorkspacePrimitives";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireAdminPageAccess } from "@/lib/admin-page";
import { listSourceConfigs, listViewConfigs } from "@/lib/config/store";
import { publicInteractiveHref } from "@/lib/public-view-href";

export default async function ViewsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdminPageAccess("/admin/views");
  const [sources, views] = await Promise.all([listSourceConfigs(), listViewConfigs()]);
  const sourceMap = new Map(sources.map((source) => [source.id, source.label]));
  const uniquePublicSlug = (slug: string) =>
    views.filter((view) => view.public && view.slug === slug).length === 1;

  const params = await searchParams;
  const page = resolveAdminTablePage(params.page, views.length);

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Admin builder"
        title="Views"
        description="Editable definitions that map source fields to a public route. Preview before you publish."
        actions={
          <Link href="/admin/views/new">
            <Button variant="primary">New view</Button>
          </Link>
        }
      />
      <AdminDataTable
        headers={["View", "Source", "Route", "Status"]}
        items={views}
        page={page}
        basePath="/admin/views"
        getRowKey={(view) => view.id}
        empty={
          <EmptyState
            icon={<span className="font-serif text-lg">▦</span>}
            title="No views yet"
            description="A view starts from a source. Register a source first, then choose the fields to expose."
            action={{ href: "/admin/sources", label: "Go to sources" }}
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
            <div className="flex flex-wrap items-center gap-2">
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
    </section>
  );
}
