import Link from "next/link";
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
        description="Register Smartsheet sheets and reports that power workspace views."
        actions={
          <Link href="/admin/sources/new" className="btn-crimson rounded-full bg-wsu-crimson px-4 py-2 text-sm font-medium hover:bg-wsu-crimson-dark">
            Create source
          </Link>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {sources.map((source) => (
          <article key={source.id} className="rounded-[1.75rem] border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] p-6 shadow-[0_16px_40px_rgba(35,31,32,0.06)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--wsu-crimson)]">{source.sourceType}</p>
                <h3 className="mt-2 text-2xl font-semibold text-[color:var(--wsu-ink)]">{source.label}</h3>
                <p className="mt-2 text-sm text-[color:var(--wsu-muted)]">ID: {source.id} · Smartsheet {source.smartsheetId}</p>
                <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">Views attached: {viewsBySource.get(source.id) ?? 0}</p>
              </div>
              <Link href={`/admin/sources/${source.id}`} className="inline-flex items-center rounded-full border border-[color:var(--wsu-border)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--wsu-muted)] hover:border-[color:var(--wsu-crimson)] hover:text-[color:var(--wsu-crimson)]">Edit</Link>
            </div>
          </article>
        ))}
        {sources.length === 0 && <p className="text-sm text-[color:var(--wsu-muted)]">No sources registered.</p>}
      </div>
    </section>
  );
}