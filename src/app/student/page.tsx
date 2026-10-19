import type { Metadata } from "next";
import { StudentPageFrame } from "@/components/forms/student/StudentPageFrame";
import { StudentSheetTable } from "@/components/forms/student/StudentSheetTable";
import { readStudentSessionEmail } from "@/lib/forms/student-auth";
import { getStudentConfigurationError } from "@/lib/forms/student-users";
import { isOktaConfigured } from "@/lib/okta/config";

export const metadata: Metadata = {
  title: "Graduate School Student Portal",
  description: "View your form submissions and propose contact reroutes for Programs Team review.",
};

export const dynamic = "force-dynamic";

export default async function StudentMySubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; error?: string }>;
}) {
  const configurationError = getStudentConfigurationError();
  const oktaEnabled = isOktaConfigured();
  const email = configurationError && !oktaEnabled ? null : await readStudentSessionEmail();
  const { page, error } = await searchParams;
  const errorMessage = typeof error === "string" && error.trim() ? error.trim() : null;

  return (
    <StudentPageFrame
      title="Graduate School Student Portal"
      description="View your submission sheets, track their status, and propose contact reroutes for Programs Team review."
    >
      {configurationError && !oktaEnabled ? (
        <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Student sign-in is not configured: {configurationError}
        </div>
      ) : (
        <StudentSheetTable
          initialEmail={email}
          page={page}
          oktaEnabled={oktaEnabled}
          errorMessage={errorMessage}
        />
      )}
    </StudentPageFrame>
  );
}
