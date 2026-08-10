import type { Metadata } from "next";
import { StudentPageFrame } from "@/components/forms/student/StudentPageFrame";
import { StudentSheetTable } from "@/components/forms/student/StudentSheetTable";
import { readStudentSessionEmail } from "@/lib/forms/student-auth";
import { getStudentConfigurationError } from "@/lib/forms/student-users";

export const metadata: Metadata = {
  title: "My submissions - Graduate School Forms",
  description: "View your form submissions and propose contact reroutes for Programs Team review.",
};

export const dynamic = "force-dynamic";

export default async function StudentMySubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const configurationError = getStudentConfigurationError();
  const email = configurationError ? null : await readStudentSessionEmail();
  const { page } = await searchParams;

  return (
    <StudentPageFrame
      breadcrumbs={[{ href: null, label: "My submissions" }]}
      title="My submissions"
      description="View your submission sheets, track their status, and propose contact reroutes for Programs Team review."
    >
      {configurationError ? (
        <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Student sign-in is not configured: {configurationError}
        </div>
      ) : (
        <StudentSheetTable initialEmail={email} page={page} />
      )}
    </StudentPageFrame>
  );
}
