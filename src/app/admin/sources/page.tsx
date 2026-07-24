import Link from "next/link";
import {
  AdminDataTable,
  resolveAdminTablePage,
} from "@/components/admin/AdminDataTable";
import { SourcesUseInFormsButton } from "@/components/admin/SourcesUseInFormsButton";
import { Button, EmptyState } from "@/components/admin/WorkspacePrimitives";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireAdminPageAccess } from "@/lib/admin-page";
import { listSourceConfigs, listViewConfigs } from "@/lib/config/store";

export default async function SourcesIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdminPageAccess("/admin/sources");
  const [sources, views] = await Promise.all([listSourceConfigs(), listViewConfigs()]);
  const viewsBySource = views.reduce<Map<string, number>>((map, view) => {
    map.set(view.sourceId, (map.get(view.sourceId) ?? 0) + 1);
    return map;
  }, new Map());

  const params = await searchParams;
  const page = resolveAdminTablePage(params.page, sources.length);

  return (
    <section className="space-y-6">
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
      <AdminDataTable
        headers={["Source", "Connection", "Views", "Forms", "Actions"]}
        items={sources}
        page={page}
        basePath="/admin/sources"
        endAlignLastHeader
        getRowKey={(source) => source.id}
        empty={
          <EmptyState
            icon={<span className="font-serif text-lg">↔</span>}
            title="No sources registered"
            description="Connect a Smartsheet sheet or report to sync its columns and rows into the workspace."
            action={{ href: "/admin/sources/new", label: "Register your first source" }}
            variant="panel"
          />
        }
        renderRow={(source) => {
          const formsEnabled = source.sourceType === "sheet" && source.formsEnabled !== false;
          const formsStatus = !formsEnabled
            ? "Views only"
            : source.formPublic
              ? `Published /f/${source.formSlug || "…"}`
              : "Available in Forms";
          return (
            <>
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
            </>
          );
        }}
      />
    </section>
  );
}
