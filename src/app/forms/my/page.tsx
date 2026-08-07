import type { Metadata } from "next";
import { FormBrandHeader } from "@/components/forms/submission/FormBrandHeader";
import { StudentPortal } from "@/components/forms/student/StudentPortal";
import { getContributorConfigurationError } from "@/lib/contributor-auth";
import { readStudentSessionEmail } from "@/lib/forms/student-auth";

export const metadata: Metadata = {
  title: "My submissions - Graduate School Forms",
  description: "View your form submissions and propose contact reroutes for Programs Team review.",
};

export const dynamic = "force-dynamic";

export default async function StudentMySubmissionsPage() {
  const configurationError = getContributorConfigurationError();
  const email = configurationError ? null : await readStudentSessionEmail();

  if (configurationError) {
    return (
      <div className="min-h-screen bg-[color:var(--wsu-stone,#f7f5f2)] text-[color:var(--wsu-ink)]">
        <FormBrandHeader />
        <div className="px-4 py-8 sm:px-7 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <div
              role="alert"
              className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              Student sign-in is not configured: {configurationError}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <StudentPortal initialEmail={email} />;
}
