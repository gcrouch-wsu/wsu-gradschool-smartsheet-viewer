import type { ReactNode } from "react";
import type { ProductNavItem } from "@/lib/product-navigation";
import { ProductBreadcrumbs } from "@/components/layout/ProductBreadcrumbs";
import { ProductNav } from "@/components/layout/ProductNav";

interface ProductShellProps {
  children: ReactNode;
  globalNav: ProductNavItem[];
  contextNav?: ProductNavItem[];
  actions?: ReactNode;
  eyebrow?: string;
  title?: string;
  description?: string;
}

export function ProductShell({
  children,
  globalNav,
  contextNav,
  actions,
  eyebrow = "Washington State University",
  title = "Smartsheet Workspace",
  description = "Manage sources, views, submissions, and approval workflows.",
}: ProductShellProps) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,rgba(166,15,45,0.06),rgba(248,246,243,0.8))] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-[1.75rem] border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] shadow-[0_24px_64px_rgba(35,31,32,0.07)]">
          <header className="border-b border-[color:var(--wsu-border)] px-5 py-5 sm:px-8 sm:py-6">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-wsu-crimson text-xs font-semibold text-white">
                  WSU
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-wsu-crimson">{eyebrow}</p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--wsu-ink)]">{title}</h1>
                  <p className="mt-1 max-w-3xl text-sm text-[color:var(--wsu-muted)]">{description}</p>
                </div>
              </div>
              {actions ? <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div> : null}
            </div>
            {globalNav.length > 0 ? (
              <div className="mt-5">
                <ProductNav items={globalNav} label="Product navigation" />
              </div>
            ) : null}
          </header>

          {contextNav ? <ProductNav items={contextNav} variant="context" label="Forms navigation" /> : null}

          <div className="p-5 sm:p-6">
            <ProductBreadcrumbs />
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
