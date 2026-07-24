import { redirect } from "next/navigation";
import { AdminSignInForm } from "@/components/admin/AdminSignInForm";
import { FormBrandHeader } from "@/components/forms/submission/FormBrandHeader";
import {
  ADMIN_PASSWORD_POLICY_MESSAGE,
  getAdminConfigurationError,
  normalizeAdminNextPath,
} from "@/lib/admin-auth";
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
    <main className="min-h-screen bg-[color:var(--wsu-stone,#f7f5f2)]">
      <FormBrandHeader maxWidthClassName="max-w-6xl" />
      <div className="px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-md rounded-[2rem] border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] p-8 shadow-[0_24px_64px_rgba(35,31,32,0.07)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--wsu-crimson)]">Admin access</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[color:var(--wsu-ink)]">Sign in</h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--wsu-muted)]">
            Sign in with the bootstrap owner account from environment variables or a managed admin account created in the
            app.
          </p>

          {configurationError && (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              {configurationError}
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-3 text-sm text-[color:var(--wsu-muted)]">
            Password requirement: {ADMIN_PASSWORD_POLICY_MESSAGE.replace("Admin password must be ", "")}
          </div>

          <div className="mt-6">
            <AdminSignInForm nextPath={nextPath} disabled={Boolean(configurationError)} />
          </div>
        </div>
      </div>
    </main>
  );
}
