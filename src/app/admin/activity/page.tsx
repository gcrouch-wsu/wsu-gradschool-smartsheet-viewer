import {
  AdminDataTable,
  resolveAdminTablePage,
} from "@/components/admin/AdminDataTable";
import { ActivityFilters } from "@/components/admin/ActivityFilters";
import {
  ACTIVITY_TOUR_STEPS,
  ACTIVITY_TOUR_STORAGE_KEY,
} from "@/components/admin/tours/activity-tour";
import { EmptyState } from "@/components/admin/WorkspacePrimitives";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProductTourControls } from "@/components/ui/ProductTourHost";
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
        description="Audit trail for admin clicks and page views, user and student preview access, form/source/view changes, publish actions, and related staff activity."
        dataTour="aa-heading"
        actions={
          <ProductTourControls storageKey={ACTIVITY_TOUR_STORAGE_KEY} steps={ACTIVITY_TOUR_STEPS} />
        }
      />

      <ActivityFilters actorId={actorId} resourceType={resourceType} />

      <div data-tour="aa-table">
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
              description="Clicks, page views, publishing views, user changes, student preview, and form builder saves will show up here."
              variant="panel"
            />
          }
          renderRow={(event) => {
            const metaLabel =
              event.metadata && typeof event.metadata.label === "string"
                ? event.metadata.label
                : event.metadata && typeof event.metadata.path === "string"
                  ? event.metadata.path
                  : null;
            return (
            <>
              <p className="min-w-0 text-sm text-sub">{new Date(event.createdAt).toLocaleString()}</p>
              <div className="min-w-0">
                <p className="font-medium text-ink">{event.actorLabel ?? event.actorId}</p>
                <p className="mt-1 text-xs text-mist">{event.actorKind}</p>
              </div>
              <div className="min-w-0">
                <p className="text-sm text-ink">{event.action}</p>
                {metaLabel ? <p className="mt-1 text-xs text-mist">{metaLabel}</p> : null}
              </div>
              <p className="min-w-0 text-sm text-sub">
                {event.resourceType}
                {event.resourceId ? ` / ${event.resourceId}` : ""}
              </p>
            </>
            );
          }}
        />
      </div>
    </div>
  );
}
