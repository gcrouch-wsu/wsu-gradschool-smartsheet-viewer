import Link from "next/link";
import { Button, EmptyState, TableShell } from "@/components/admin/WorkspacePrimitives";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireAdminPageAccess } from "@/lib/admin-page";
import { listSourceConfigs, listViewConfigs } from "@/lib/config/store";
import { publicInteractiveHref } from "@/lib/public-view-href";

export default async function ViewsIndexPage() {
  await requireAdminPageAccess("/admin/views");
  const [sources, views] = await Promise.all([listSourceConfigs(), listViewConfigs()]);
  const sourceMap = new Map(sources.map((source) => [source.id, source.label]));

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="Admin builder"
        title="Views"
        description="Editable definitions that map source fields to a public route. Preview before you publish."
        actions={
          <Link href="/admin/views/new"><Button variant="primary">New view</Button></Link>
        }
      />
      <TableShell headers={["View", "Source", "Route", "Status"]}>
        {views.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={<span className="font-serif text-lg">▦</span>} title="No views yet" description="A view starts from a source. Register a source first, then choose the fields to expose." action={{ href: "/admin/sources", label: "Go to sources" }} variant="panel" />
          </div>
        ) : (
          <div className="divide-y divide-line">
            {views.map((view) => (
              <div key={view.id} className="grid grid-cols-2 gap-3 px-5 py-4 sm:grid-cols-4">
                <div><Link href={`/admin/views/${view.id}`} className="font-medium text-ink hover:text-crimson">{view.label}</Link><p className="mt-1 text-xs text-sub">{view.layout}</p></div>
                <p className="text-sm text-sub">{sourceMap.get(view.sourceId) ?? view.sourceId}</p>
                <code className="truncate text-xs text-sub">{publicInteractiveHref(view.slug, view.id, views.filter((v) => v.public && v.slug === view.slug).length === 1)}</code>
                <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs uppercase tracking-wide text-crimson">{view.public ? "Published" : "Draft"}</span><Link href={`/admin/views/${view.id}/preview`} className="text-xs font-medium text-crimson hover:underline">Preview</Link></div>
              </div>
            ))}
          </div>
        )}
      </TableShell>
    </section>
  );
}
