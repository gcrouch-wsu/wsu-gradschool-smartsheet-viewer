import Link from "next/link";
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

  const principalLabel = principal.displayName ?? principal.username;

  return (
    <ProductShell
      globalNav={productNav(true, principal.role === "owner")}
      eyebrow="Washington State University"
      title="Smartsheet Workspace"
      description="Register sources, build views, manage submissions, and administer approval workflows."
      identity={
        <div className="flex items-center gap-2.5 rounded-full border border-line-strong bg-white py-2 pl-2 pr-4 text-left">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--crimson-soft)] font-mono text-xs font-semibold text-crimson">
            {principalLabel.slice(0, 2).toUpperCase()}
          </span>
          <span>
            <span className="block text-[13.5px] font-semibold leading-none text-ink">{principalLabel}</span>
            <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-mist">{principal.role === "owner" ? "Owner" : "Admin"}</span>
          </span>
        </div>
      }
      actions={
        <>
          <Link href="/instructions/admin" className="flex items-center gap-1.5 rounded-full border border-[var(--crimson-line)] bg-white px-4 py-2 text-[13.5px] font-medium text-crimson transition hover:bg-[var(--crimson-soft)]">
            <ToolbarIcon kind="guide" />
            Admin guide
          </Link>
          <Link href="/admin/sources/new" className="flex items-center gap-1.5 rounded-full border border-line-strong bg-white px-4 py-2 text-[13.5px] font-medium text-ink transition hover:border-mist hover:bg-[#faf7f8]">
            <ToolbarIcon kind="plus" />
            New source
          </Link>
          <Link href="/admin/views/new" className="flex items-center gap-1.5 rounded-full border border-crimson bg-crimson px-4 py-2 text-[13.5px] font-medium text-white shadow-[0_2px_6px_rgba(152,30,50,0.24)] transition hover:bg-[var(--crimson-deep)]">
            <ToolbarIcon kind="plus" />
            New view
          </Link>
          <AdminLogoutButton />
        </>
      }
    >
      <AdminToastWrapper>{children}</AdminToastWrapper>
    </ProductShell>
  );
}

function ToolbarIcon({ kind }: { kind: "guide" | "plus" }) {
  const paths = {
    guide: <><path d="M4 4.5A2.5 2.5 0 016.5 2H20v15H6.5A2.5 2.5 0 004 19.5z" /><path d="M4 19.5A2.5 2.5 0 016.5 17H20v5H6.5A2.5 2.5 0 014 19.5z" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
  };
  return (
    <svg className="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths[kind]}
    </svg>
  );
}
