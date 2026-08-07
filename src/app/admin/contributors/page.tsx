import { resolveAdminTablePage } from "@/components/admin/AdminDataTable";
import { EmptyState } from "@/components/admin/WorkspacePrimitives";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireAdminPageAccess } from "@/lib/admin-page";
import type { ContributorAccountKind } from "@/lib/contributor-account-kinds";
import { listContributorUsers } from "@/lib/contributor-auth";
import { resolveContributorAccountKinds } from "@/lib/resolve-contributor-account-kinds";
import { ContributorAccountsManager } from "./ContributorAccountsManager";

type ContributorListUser = Awaited<ReturnType<typeof listContributorUsers>>[number] & {
  accountKind: ContributorAccountKind;
};

export default async function AdminContributorsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  await requireAdminPageAccess("/admin/contributors");

  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";

  let users: ContributorListUser[] = [];
  let dbError: string | null = null;

  try {
    const accounts = await listContributorUsers();
    let kinds = new Map<string, ContributorAccountKind>();
    try {
      kinds = await resolveContributorAccountKinds(accounts.map((user) => user.email));
    } catch {
      // Sheet lookup is best-effort; still show accounts without type labels.
    }
    users = accounts.map((user) => ({
      ...user,
      accountKind: kinds.get(user.email) ?? "none",
    }));
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
        description="Shared password accounts for contributor editing and the student portal. Type is based on current sheet membership."
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
