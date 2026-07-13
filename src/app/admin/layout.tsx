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
      actions={
        <>
          <div className="rounded-full border border-[color:var(--wsu-border)] bg-white px-4 py-2 text-right text-sm text-[color:var(--wsu-muted)]">
            <p className="font-medium text-[color:var(--wsu-ink)]">{principalLabel}</p>
            <p>{principal.role === "owner" ? "Bootstrap owner" : "Managed admin"}</p>
          </div>
          <Link href="/instructions/admin" className="rounded-full border border-[color:var(--wsu-crimson)] bg-white px-4 py-2 text-sm font-medium text-wsu-crimson hover:bg-wsu-crimson/5">
            Admin guide
          </Link>
          <Link href="/admin/sources/new" className="rounded-full border border-[color:var(--wsu-border)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--wsu-muted)] hover:border-wsu-crimson hover:text-wsu-crimson">
            New source
          </Link>
          <Link href="/admin/views/new" className="btn-crimson rounded-full bg-wsu-crimson px-4 py-2 text-sm font-medium hover:bg-wsu-crimson-dark">
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
