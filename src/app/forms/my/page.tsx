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

  return (
    <div className="min-h-screen bg-[color:var(--wsu-stone,#f7f5f2)] text-[color:var(--wsu-ink)]">
      <FormBrandHeader maxWidthClassName="max-w-3xl" />
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <header className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--wsu-crimson)]">
              Graduate School
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">My submissions</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[color:var(--wsu-muted)]">
              Sign in with your @wsu.edu Student Email to see sheets that include you, view your rows, and propose
              contact reroutes for Programs Team review.
            </p>
          </header>

          {configurationError ? (
            <div
              role="alert"
              className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              Student sign-in is not configured: {configurationError}
            </div>
          ) : (
            <StudentPortal initialEmail={email} />
          )}
        </div>
      </div>
    </div>
  );
}
