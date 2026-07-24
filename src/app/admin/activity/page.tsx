import {
  AdminDataTable,
  resolveAdminTablePage,
} from "@/components/admin/AdminDataTable";
import { ActivityFilters } from "@/components/admin/ActivityFilters";
import { EmptyState } from "@/components/admin/WorkspacePrimitives";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireAdminPageAccess } from "@/lib/admin-page";
import { listAuditEvents } from "@/lib/audit";

export const dynamic = "force-dynamic";

function activityBasePath(actorId: string, resourceType: string): string {
  const params = new URLSearchParams();
  if (actorId.trim()) params.set("actorId", actorId.trim());
  if (resourceType.trim()) params.set("resourceType", resourceType.trim());
  const qs = params.toString();
  return qs ? `/admin/activity?${qs}` : "/admin/activity";
}

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ actorId?: string; resourceType?: string; page?: string }>;
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

  const page = resolveAdminTablePage(params.page, events.length);
  const basePath = activityBasePath(actorId, resourceType);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin builder"
        title="Activity"
        description="Audit trail for source/view publishes, form registry changes, builder saves, and related actions."
      />

      <ActivityFilters actorId={actorId} resourceType={resourceType} />

      <AdminDataTable
        headers={["When", "Actor", "Action", "Resource"]}
        items={events}
        page={page}
        basePath={basePath}
        getRowKey={(event) => event.id}
        empty={
          <EmptyState
            icon={<span className="font-serif text-lg">◷</span>}
            title="No audit events yet"
            description="Actions like publishing views, registering sources, and saving form builders will show up here."
            variant="panel"
          />
        }
        renderRow={(event) => (
          <>
            <p className="min-w-0 text-sm text-sub">{new Date(event.createdAt).toLocaleString()}</p>
            <div className="min-w-0">
              <p className="font-medium text-ink">{event.actorLabel ?? event.actorId}</p>
              <p className="mt-1 text-xs text-mist">{event.actorKind}</p>
            </div>
            <p className="min-w-0 text-sm text-ink">{event.action}</p>
            <p className="min-w-0 text-sm text-sub">
              {event.resourceType}
              {event.resourceId ? ` / ${event.resourceId}` : ""}
            </p>
          </>
        )}
      />
    </div>
  );
}
