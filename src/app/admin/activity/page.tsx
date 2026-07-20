import { PageHeader } from "@/components/layout/PageHeader";
import { requireAdminPageAccess } from "@/lib/admin-page";
import { listAuditEvents } from "@/lib/audit";
import { ActivityFilters } from "@/components/admin/ActivityFilters";
import { DataTable } from "@/components/ui/Table";

export const dynamic = "force-dynamic";

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ actorId?: string; resourceType?: string }>;
}) {
  await requireAdminPageAccess("/admin/activity");
  const params = await searchParams;
  const actorId = typeof params.actorId === "string" ? params.actorId : "";
  const resourceType = typeof params.resourceType === "string" ? params.resourceType : "";

  const events = await listAuditEvents({
    limit: 100,
    actorId: actorId.trim() || undefined,
    resourceType: resourceType.trim() || undefined,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Activity"
        description="Audit trail for source/view publishes, form registry changes, builder saves, and related actions."
      />

      <ActivityFilters actorId={actorId} resourceType={resourceType} />

      {events.length === 0 ? (
        <p className="product-empty">No audit events yet.</p>
      ) : (
        <DataTable
          columns={[
            {
              id: "when",
              header: "When",
              headerClassName: "px-3 py-2 text-sub",
              cellClassName: "px-3 py-2 text-sub",
              cell: (e) => new Date(e.createdAt).toLocaleString(),
            },
            {
              id: "actor",
              header: "Actor",
              headerClassName: "px-3 py-2 text-sub",
              cellClassName: "px-3 py-2",
              cell: (e) => (
                <>
                  <span className="font-medium text-ink">{e.actorLabel ?? e.actorId}</span>
                  <span className="mt-0.5 block text-xs text-mist">{e.actorKind}</span>
                </>
              ),
            },
            {
              id: "action",
              header: "Action",
              headerClassName: "px-3 py-2 text-sub",
              cellClassName: "px-3 py-2 text-ink",
              cell: (e) => e.action,
            },
            {
              id: "resource",
              header: "Resource",
              headerClassName: "px-3 py-2 text-sub",
              cellClassName: "px-3 py-2 text-sub",
              cell: (e) => `${e.resourceType}${e.resourceId ? ` / ${e.resourceId}` : ""}`,
            },
          ]}
          data={events}
          getRowKey={(e) => e.id}
          headerRowClassName="border-line"
          rowClassName="border-line hover:bg-transparent"
          minWidth={640}
          containerClassName="rounded-xl border border-line"
        />
      )}
    </div>
  );
}
