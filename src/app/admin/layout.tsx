import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminToastWrapper } from "@/components/admin/AdminToastWrapper";
import { ProductShell } from "@/components/layout/ProductShell";
import { getCurrentAdminAuthResult } from "@/lib/admin-users";
import { productNav } from "@/lib/product-navigation";
import { AdminLogoutButton } from "./AdminLogoutButton";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await getCurrentAdminAuthResult();
  const principal = auth.ok ? auth.principal : null;

  if (!principal) {
    return <>{children}</>;
  }

  if (principal.role === "coordinator") {
    redirect("/forms/sheet");
  }

  const principalLabel = principal.displayName ?? principal.username;

  return (
    <ProductShell
      globalNav={productNav(true)}
      eyebrow="Washington State University"
      title="Smartsheet Workspace"
      description="Register sources, build views, manage submissions, and administer approval workflows."
      identity={
        <div className="flex w-full min-w-0 items-center gap-2.5 rounded-full border border-line-strong bg-white py-2 pl-2 pr-4 text-left transition hover:border-mist xl:w-auto">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--crimson-soft)] font-mono text-xs font-semibold text-crimson">
            {principalLabel.slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] font-semibold leading-none text-ink">{principalLabel}</span>
            <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-mist">
              {principal.role === "owner" ? "Owner" : principal.role === "coordinator" ? "Coordinator" : "Admin"}
            </span>
          </span>
        </div>
      }
      actions={
        <>
          <Link
            href="/instructions/admin"
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-[var(--crimson-line)] bg-white px-3 py-2 text-[13.5px] font-medium text-crimson transition hover:bg-[var(--crimson-soft)] xl:flex-none xl:px-4"
          >
            <ToolbarIcon kind="guide" />
            <span className="xl:hidden">Guide</span>
            <span className="hidden xl:inline">Admin guide</span>
          </Link>
          <AdminLogoutButton />
        </>
      }
    >
      <AdminToastWrapper>{children}</AdminToastWrapper>
    </ProductShell>
  );
}

function ToolbarIcon({ kind }: { kind: "guide" }) {
  const paths = {
    guide: <><path d="M4 4.5A2.5 2.5 0 016.5 2H20v15H6.5A2.5 2.5 0 004 19.5z" /><path d="M4 19.5A2.5 2.5 0 016.5 17H20v5H6.5A2.5 2.5 0 014 19.5z" /></>,
  };
  return (
    <svg className="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths[kind]}
    </svg>
  );
}
