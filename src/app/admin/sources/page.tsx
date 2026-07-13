import Link from "next/link";
import { Button, EmptyState, TableShell } from "@/components/admin/WorkspacePrimitives";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireAdminPageAccess } from "@/lib/admin-page";
import { listSourceConfigs, listViewConfigs } from "@/lib/config/store";

export default async function SourcesIndexPage() {
  await requireAdminPageAccess("/admin/sources");
  const [sources, views] = await Promise.all([listSourceConfigs(), listViewConfigs()]);
  const viewsBySource = views.reduce<Map<string, number>>((map, view) => {
    map.set(view.sourceId, (map.get(view.sourceId) ?? 0) + 1);
    return map;
  }, new Map());

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="Admin builder"
        title="Sources"
        description="Registered Smartsheet sheets and reports, with their connection, schema, and role groups."
        actions={
          <Link href="/admin/sources/new"><Button variant="primary">New source</Button></Link>
        }
      />
      <TableShell headers={["Source", "Connection", "Views", "Status"]}>
        {sources.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={<span className="font-serif text-lg">↔</span>} title="No sources registered" description="Connect a Smartsheet sheet or report to sync its columns and rows into the workspace." action={{ href: "/admin/sources/new", label: "Register your first source" }} variant="panel" />
          </div>
        ) : (
          <div className="divide-y divide-line">
            {sources.map((source) => (
              <Link key={source.id} href={`/admin/sources/${source.id}`} className="grid grid-cols-2 gap-3 px-5 py-4 transition hover:bg-[#fdfafb] sm:grid-cols-4">
                <div><p className="font-medium text-ink">{source.label}</p><p className="mt-1 text-xs text-sub">{source.id}</p></div>
                <p className="text-sm text-sub">{source.sourceType} · {source.smartsheetId}</p>
                <p className="text-sm text-sub">{viewsBySource.get(source.id) ?? 0} attached</p>
                <p className="font-mono text-xs uppercase tracking-wide text-crimson">Configured</p>
              </Link>
            ))}
          </div>
        )}
      </TableShell>
    </section>
  );
}