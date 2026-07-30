import type { Metadata } from "next";
import { AdminResetPasswordForm } from "@/components/admin/AdminResetPasswordForm";
import { FormBrandHeader } from "@/components/forms/submission/FormBrandHeader";

export const metadata: Metadata = {
  title: "Reset your admin password",
};

export default async function AdminResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const tokenLooksValid = typeof token === "string" && token.includes(".");

  return (
    <main className="relative min-h-screen overflow-hidden bg-[color:var(--wsu-paper)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -10%, rgba(152, 30, 50, 0.14), transparent 55%),
            radial-gradient(ellipse 60% 40% at 100% 100%, rgba(152, 30, 50, 0.06), transparent 50%),
            linear-gradient(180deg, #faf8f9 0%, #f4f0f1 100%)
          `,
        }}
      />

      <div className="relative z-10">
        <FormBrandHeader maxWidthClassName="max-w-6xl" />

        <div className="flex min-h-[calc(100vh-4.5rem)] flex-col justify-center px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto w-full max-w-[26rem]">
            <div className="mb-8 text-center sm:mb-10 sm:text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--wsu-crimson)]">
                Graduate School
              </p>
              <h1
                className="mt-3 text-[2rem] font-medium leading-tight tracking-[-0.03em] text-[color:var(--wsu-ink)] sm:text-[2.25rem]"
                style={{ fontFamily: "var(--font-workspace-serif), Georgia, serif" }}
              >
                Reset password
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-[15px]">
                Choose a new password for your admin account.
              </p>
            </div>

            <section
              aria-labelledby="admin-reset-heading"
              className="rounded-2xl border border-[color:var(--wsu-border)] bg-white/90 p-6 shadow-[var(--shadow-md)] backdrop-blur-sm sm:p-8"
            >
              <h2 id="admin-reset-heading" className="sr-only">
                Reset password form
              </h2>

              {tokenLooksValid ? (
                <AdminResetPasswordForm token={token} />
              ) : (
                <div
                  role="alert"
                  className="flex gap-3 rounded-xl border border-[color:var(--product-err)]/25 bg-[color:var(--product-err)]/5 px-4 py-4 text-sm text-[color:var(--product-err)]"
                >
                  <svg
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                  >
                    <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM7.25 5h1.5v4.5h-1.5V5Zm.75 7a.875.875 0 1 1 0-1.75A.875.875 0 0 1 8 12Z" />
                  </svg>
                  <div>
                    <p className="font-medium">This reset link is invalid or has already been used.</p>
                    <p className="mt-1 text-[color:var(--wsu-muted)]">
                      Ask another admin to generate a new one from Admins.
                    </p>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
