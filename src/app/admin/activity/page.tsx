import { headers } from "next/headers";
import {
  AdminDataTable,
  resolveAdminTablePage,
} from "@/components/admin/AdminDataTable";
import { ActivityFilters } from "@/components/admin/ActivityFilters";
import { ActivitySectionTabs } from "@/components/admin/ActivitySectionTabs";
import { EmailDeliveryPanel } from "@/components/admin/EmailDeliveryPanel";
import { FailedRunsPanel } from "@/components/admin/FailedRunsPanel";
import {
  ACTIVITY_TOUR_STEPS,
  ACTIVITY_TOUR_STORAGE_KEY,
} from "@/components/admin/tours/activity-tour";
import { EmptyState } from "@/components/admin/WorkspacePrimitives";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProductTourControls } from "@/components/ui/ProductTourHost";
import { requireAdminPageAccess } from "@/lib/admin-page";
import { listAuditEvents } from "@/lib/audit";
import { getPublicOrigin } from "@/lib/request-ip";
import { isSesEventKind } from "@/lib/ses/events";
import { listSesEvents } from "@/lib/ses/store";
import { listActivityFailures } from "@/lib/workflows/activity-failures";

export const dynamic = "force-dynamic";

function activityBasePath(actorId: string, resourceType: string): string {
  const params = new URLSearchParams();
  if (actorId.trim()) params.set("actorId", actorId.trim());
  if (resourceType.trim()) params.set("resourceType", resourceType.trim());
  const qs = params.toString();
  return qs ? `/admin/activity?${qs}` : "/admin/activity";
}

function webhookUrlFrom(requestHeaders: Headers): string {
  const origin = getPublicOrigin(requestHeaders);
  if (origin) return `${origin}/api/webhooks/ses`;
  const host = requestHeaders.get("host")?.trim();
  if (host && !host.includes("/")) return `http://${host}/api/webhooks/ses`;
  return "/api/webhooks/ses";
}

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ actorId?: string; resourceType?: string; page?: string; tab?: string; kind?: string; q?: string }>;
}) {
  await requireAdminPageAccess("/admin/activity");
  const params = await searchParams;
  const tab = params.tab === "email" ? "email" : params.tab === "runs" ? "runs" : "audit";
  const actorId = typeof params.actorId === "string" ? params.actorId : "";
  const resourceType = typeof params.resourceType === "string" ? params.resourceType : "";
  const kind = typeof params.kind === "string" && isSesEventKind(params.kind) ? params.kind : null;
  const query = typeof params.q === "string" ? params.q : "";

  const events = await listAuditEvents({
    limit: 100,
    actorId: actorId.trim() || undefined,
    resourceType: resourceType.trim() || undefined,
  });

  const page = resolveAdminTablePage(params.page, events.length);
  const basePath = activityBasePath(actorId, resourceType);
  const email = tab === "email" ? await listSesEvents({ kind, query }) : null;
  const emailPage = email ? resolveAdminTablePage(params.page, email.events.length) : 1;
  const failures = tab === "runs" ? await listActivityFailures() : null;
  const failurePage = failures ? resolveAdminTablePage(params.page, failures.runs.length) : 1;
  const description =
    tab === "email"
      ? "Sends, deliveries, bounces, complaints, delays, rejects, rendering failures, and subscription changes reported by Amazon SES."
      : tab === "runs"
        ? "Workflow runs that failed. Each one retries after 60 seconds, up to three times."
        : "Audit trail for admin clicks and page views, user and student preview access, form/source/view changes, publish actions, and related staff activity.";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin builder"
        title="Activity"
        description={description}
        dataTour="aa-heading"
        actions={
          tab === "audit" ? (
            <ProductTourControls storageKey={ACTIVITY_TOUR_STORAGE_KEY} steps={ACTIVITY_TOUR_STEPS} />
          ) : null
        }
      />

      <ActivitySectionTabs tab={tab} />

      {tab === "email" && email ? (
        <EmailDeliveryPanel
          events={email.events}
          counts={email.counts}
          kind={kind}
          query={query}
          page={emailPage}
          available={email.available}
          webhookUrl={webhookUrlFrom(await headers())}
        />
      ) : tab === "runs" && failures ? (
        <FailedRunsPanel runs={failures.runs} page={failurePage} available={failures.available} />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
