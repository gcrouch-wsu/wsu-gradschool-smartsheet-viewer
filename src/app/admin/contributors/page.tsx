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
    <>
      <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] px-6 py-6 shadow-[0_24px_64px_rgba(35,31,32,0.07)] sm:px-8">
        <div className="mb-6">
          <PageHeader
            eyebrow="Admin builder"
            title="Contributor accounts"
            description="Manage contributor accounts and generate one-time password reset links."
          />
        </div>

        {dbError ? (
          <div
            role="alert"
            className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900"
          >
            <p className="font-medium">Contributor editing requires DATABASE_URL.</p>
            <p className="mt-1 text-xs">{dbError}</p>
          </div>
        ) : (
          <ContributorAccountsManager users={users} />
        )}
      </div>
    </>
  );
}
