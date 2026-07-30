import { redirect } from "next/navigation";
import { AdminSignInForm } from "@/components/admin/AdminSignInForm";
import { FormBrandHeader } from "@/components/forms/submission/FormBrandHeader";
import { getAdminConfigurationError, normalizeAdminNextPath } from "@/lib/admin-auth";
import { getCurrentAdminAuthResult } from "@/lib/admin-users";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminSignInPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const nextPath = normalizeAdminNextPath(firstValue(resolvedSearchParams.next));
  const configurationError = getAdminConfigurationError();
  const auth = await getCurrentAdminAuthResult();

  if (auth.ok) {
    redirect(nextPath);
  }

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
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23981e32' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
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
                Admin sign in
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-[15px]">
                Use your admin email to continue. New accounts set a password on first access.
              </p>
            </div>

            <section
              aria-labelledby="admin-sign-in-heading"
              className="rounded-2xl border border-[color:var(--wsu-border)] bg-white/90 p-6 shadow-[var(--shadow-md)] backdrop-blur-sm sm:p-8"
            >
              <h2 id="admin-sign-in-heading" className="sr-only">
                Sign in form
              </h2>

              {configurationError ? (
                <div
                  role="alert"
                  className="mb-6 rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950"
                >
                  <p className="font-medium">Configuration needed</p>
                  <p className="mt-1">{configurationError}</p>
                </div>
              ) : null}

              <AdminSignInForm nextPath={nextPath} disabled={Boolean(configurationError)} />
            </section>

            <p className="mt-6 text-center text-xs leading-relaxed text-[color:var(--mist)] sm:text-left">
              Authorized staff only. Sessions expire after inactivity for security.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
