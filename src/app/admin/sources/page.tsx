import Link from "next/link";
import { SourcesUseInFormsButton } from "@/components/admin/SourcesUseInFormsButton";
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
        description="Shared Smartsheet catalog for public views and Forms. Select a sheet source to configure views or manage forms."
        actions={
          <Link href="/admin/sources/new">
            <Button variant="primary">New source</Button>
          </Link>
        }
      />
      <TableShell headers={["Source", "Connection", "Views", "Forms", "Actions"]} endAlignLastHeader>
        {sources.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<span className="font-serif text-lg">↔</span>}
              title="No sources registered"
              description="Connect a Smartsheet sheet or report to sync its columns and rows into the workspace."
              action={{ href: "/admin/sources/new", label: "Register your first source" }}
              variant="panel"
            />
          </div>
        ) : (
          <div className="divide-y divide-line">
            {sources.map((source) => {
              const formsEnabled = source.sourceType === "sheet" && source.formsEnabled !== false;
              const formsStatus = !formsEnabled
                ? "Views only"
                : source.formPublic
                  ? `Published /f/${source.formSlug || "…"}`
                  : "Available in Forms";
              return (
                <div
                  key={source.id}
                  className="grid grid-cols-2 gap-3 px-5 py-4 transition hover:bg-[#fdfafb] sm:grid-cols-5 sm:items-center"
                >
                  <Link href={`/admin/sources/${source.id}`} className="min-w-0">
                    <p className="font-medium text-ink">{source.label}</p>
                    <p className="mt-1 text-xs text-sub">{source.id}</p>
                  </Link>
                  <Link href={`/admin/sources/${source.id}`} className="min-w-0 text-sm text-sub">
                    <span className="break-all">
                      {source.sourceType} · {source.smartsheetId}
                    </span>
                  </Link>
                  <Link href={`/admin/sources/${source.id}`} className="text-sm text-sub">
                    {viewsBySource.get(source.id) ?? 0} attached
                  </Link>
                  <p className="min-w-0 text-sm text-sub">{formsStatus}</p>
                  <div className="flex justify-start sm:justify-end">
                    {formsEnabled ? (
                      <SourcesUseInFormsButton sourceId={source.id} sheetId={source.smartsheetId} />
                    ) : (
                      <span className="font-mono text-xs uppercase tracking-wide text-mist">Report</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </TableShell>
    </section>
  );
}
