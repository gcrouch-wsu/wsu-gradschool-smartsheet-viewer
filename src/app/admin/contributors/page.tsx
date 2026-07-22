import { EmptyState } from "@/components/admin/WorkspacePrimitives";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireAdminPageAccess } from "@/lib/admin-page";
import { listContributorUsers } from "@/lib/contributor-auth";
import { ContributorAccountsManager } from "./ContributorAccountsManager";

export default async function AdminContributorsPage() {
  await requireAdminPageAccess("/admin/contributors");

  let users: Awaited<ReturnType<typeof listContributorUsers>> = [];
  let dbError: string | null = null;

  try {
    users = await listContributorUsers();
  } catch (err) {
    dbError = err instanceof Error ? err.message : "Unable to load contributor accounts.";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin builder"
        title="Contributors"
        description="People who can submit and edit records through your forms, scoped by role group."
      />

      {dbError ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900"
        >
          <p className="font-medium">Contributor editing requires DATABASE_URL.</p>
          <p className="mt-1 text-xs">{dbError}</p>
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          icon={<span className="text-sm font-semibold">C</span>}
          title="No contributors yet"
          description="Invite colleagues to submit through forms. Assign them to a role group to control what they can see and edit."
          action={{ href: "/forms/manage", label: "Manage forms" }}
          variant="panel"
        />
      ) : (
        <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
          <ContributorAccountsManager users={users} />
        </div>
      )}
    </div>
  );
}
