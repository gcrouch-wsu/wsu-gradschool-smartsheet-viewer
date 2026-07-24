import { resolveAdminTablePage } from "@/components/admin/AdminDataTable";
import { EmptyState } from "@/components/admin/WorkspacePrimitives";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireAdminPageAccess } from "@/lib/admin-page";
import { listContributorUsers } from "@/lib/contributor-auth";
import { ContributorAccountsManager } from "./ContributorAccountsManager";

export default async function AdminContributorsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  await requireAdminPageAccess("/admin/contributors");

  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";

  let users: Awaited<ReturnType<typeof listContributorUsers>> = [];
  let dbError: string | null = null;

  try {
    users = await listContributorUsers();
  } catch (err) {
    dbError = err instanceof Error ? err.message : "Unable to load contributor accounts.";
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filteredUsers = normalizedQuery
    ? users.filter((user) => user.email.toLowerCase().includes(normalizedQuery))
    : users;
  const page = resolveAdminTablePage(params.page, filteredUsers.length);

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
      ) : users.length === 0 && !normalizedQuery ? (
        <EmptyState
          icon={<span className="text-sm font-semibold">C</span>}
          title="No contributors yet"
          description="Invite colleagues to submit through forms. Assign them to a role group to control what they can see and edit."
          action={{ href: "/forms/manage", label: "Manage forms" }}
          variant="panel"
        />
      ) : (
        <ContributorAccountsManager users={users} page={page} query={query} />
      )}
    </div>
  );
}
