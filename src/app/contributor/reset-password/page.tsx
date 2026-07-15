import type { Metadata } from "next";
import { ContributorResetPasswordForm } from "@/components/views/contributor/ContributorResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset your contributor password",
};

export default async function ContributorResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const tokenLooksValid = typeof token === "string" && token.includes(".");

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,rgba(166,15,45,0.06),rgba(248,246,243,0.9))] px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--wsu-crimson)]">
            Smartsheet View
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--wsu-ink)] sm:text-3xl">
            Reset your contributor password
          </h1>

          <div className="mt-6">
            {tokenLooksValid ? (
              <ContributorResetPasswordForm token={token} />
            ) : (
              <div
                role="alert"
                className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800"
              >
                <p className="font-medium">This reset link is invalid or has already been used.</p>
                <p className="mt-1">Contact your administrator for a new one.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
