import { PageHeader } from "@/components/layout/PageHeader";
import { requireAdminPageAccess } from "@/lib/admin-page";
import { listAuditEvents } from "@/lib/audit";
import { ActivityFilters } from "@/components/admin/ActivityFilters";

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
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-sub">
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Actor</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Resource</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 text-sub">{new Date(e.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium text-ink">{e.actorLabel ?? e.actorId}</span>
                    <span className="mt-0.5 block text-xs text-mist">{e.actorKind}</span>
                  </td>
                  <td className="px-3 py-2 text-ink">{e.action}</td>
                  <td className="px-3 py-2 text-sub">
                    {e.resourceType}
                    {e.resourceId ? ` / ${e.resourceId}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
