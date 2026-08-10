import type { Metadata } from "next";
import { FormBrandHeader } from "@/components/forms/submission/FormBrandHeader";
import { StudentResetPasswordForm } from "@/components/forms/student/StudentResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset your student password",
};

export default async function StudentResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const tokenLooksValid = typeof token === "string" && token.includes(".");

  return (
    <div className="min-h-screen bg-[color:var(--wsu-stone,#f7f5f2)] text-[color:var(--wsu-ink)]">
      <FormBrandHeader />

      <div className="px-4 py-8 sm:px-7 lg:px-8">
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] p-6 shadow-sm sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--wsu-crimson)]">
              Graduate School
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--wsu-ink)] sm:text-3xl">
              Reset your student password
            </h1>

            <div className="mt-6">
              {tokenLooksValid ? (
                <StudentResetPasswordForm token={token} />
              ) : (
                <div
                  role="alert"
                  className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800"
                >
                  <p className="font-medium">This reset link is invalid or has already been used.</p>
                  <p className="mt-1">Contact Grad School for a new one.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
