import { ContactReroutesManager } from "@/components/admin/ContactReroutesManager";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireAdminPageAccess } from "@/lib/admin-page";

export default async function AdminReroutesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  await requireAdminPageAccess("/admin/reroutes");
  const params = await searchParams;
  const statusRaw = typeof params.status === "string" ? params.status : "pending";
  const status =
    statusRaw === "approved" || statusRaw === "rejected" || statusRaw === "all" || statusRaw === "pending"
      ? statusRaw
      : "pending";
  const query = typeof params.q === "string" ? params.q : "";
  const page = Number.parseInt(params.page ?? "1", 10);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Approval workflow"
        title="Contact reroutes"
        description="Programs Team reviews proposed changes to pending approver name/email contacts. Until approved, Smartsheet is not updated and the new approver is not notified."
      />
      <ContactReroutesManager
        page={Number.isFinite(page) ? page : 1}
        query={query}
        status={status}
      />
    </div>
  );
}
