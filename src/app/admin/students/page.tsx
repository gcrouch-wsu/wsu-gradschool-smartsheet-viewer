import { resolveAdminTablePage } from "@/components/admin/AdminDataTable";
import { EmptyState } from "@/components/admin/WorkspacePrimitives";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireAdminPageAccess } from "@/lib/admin-page";
import { listStudentUsers } from "@/lib/forms/student-users";
import { ensureStudentAccountsMigrated } from "@/lib/forms/migrate-student-accounts";
import { StudentAccountsManager } from "./StudentAccountsManager";

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  await requireAdminPageAccess("/admin/students");

  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";

  let users: Awaited<ReturnType<typeof listStudentUsers>> = [];
  let dbError: string | null = null;

  try {
    await ensureStudentAccountsMigrated();
    users = await listStudentUsers();
  } catch (err) {
    dbError = err instanceof Error ? err.message : "Unable to load student accounts.";
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
        title="Students"
        description="Password accounts for the student portal (/forms/my). Separate from contributor editing accounts."
      />

      {dbError ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900"
        >
          <p className="font-medium">Student accounts require DATABASE_URL.</p>
          <p className="mt-1 text-xs">{dbError}</p>
        </div>
      ) : users.length === 0 && !normalizedQuery ? (
        <EmptyState
          icon={<span className="text-sm font-semibold">S</span>}
          title="No students yet"
          description="Accounts appear here when students claim a password at My submissions."
          action={{ href: "/forms/my", label: "Open student portal" }}
          variant="panel"
        />
      ) : (
        <StudentAccountsManager users={users} page={page} query={query} />
      )}
    </div>
  );
}
