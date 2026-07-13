import type { ReactNode } from "react";
import type { ProductNavItem } from "@/lib/product-navigation";
import { ProductBreadcrumbs } from "@/components/layout/ProductBreadcrumbs";
import { ProductNav } from "@/components/layout/ProductNav";

interface ProductShellProps {
  children: ReactNode;
  globalNav: ProductNavItem[];
  contextNav?: ProductNavItem[];
  actions?: ReactNode;
  identity?: ReactNode;
  eyebrow?: string;
  title?: string;
  description?: string;
}

export function ProductShell({
  children,
  globalNav,
  contextNav,
  actions,
  identity,
  eyebrow = "Washington State University",
  title = "Smartsheet Workspace",
  description = "Manage sources, views, submissions, and approval workflows.",
}: ProductShellProps) {
  return (
    <main className="bg-canvas min-h-screen px-4 py-6 sm:px-7 sm:py-10 lg:px-8 lg:pb-16">
      <div className="mx-auto max-w-[1200px]">
        <div className="overflow-hidden rounded-[22px] border border-line bg-surface shadow-[var(--shadow-md)]">
          <header className="border-b border-line px-5 py-5 sm:px-8 sm:py-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3.5">
                <div
                  className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] bg-[linear-gradient(155deg,#b0263c,var(--crimson)_55%,var(--crimson-deep))] text-[15px] font-semibold tracking-[0.04em] text-white shadow-[0_5px_12px_rgba(152,30,50,0.25)]"
                  aria-hidden
                >
                  WSU
                </div>
                <div className="min-w-0">
                  <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-crimson">{eyebrow}</p>
                  <h1 className="mt-1 font-serif text-[28px] font-medium leading-none tracking-[-0.02em] text-ink sm:text-[32px]">{title}</h1>
                  <p className="mt-2 max-w-[58ch] text-[13px] leading-5 text-sub">{description}</p>
                </div>
              </div>
              {identity ? <div className="flex shrink-0 items-center">{identity}</div> : null}
            </div>

            {actions ? (
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2 sm:mt-3">{actions}</div>
            ) : null}

            {globalNav.length > 0 ? (
              <div className="mt-4">
                <ProductNav items={globalNav} label="Product navigation" />
              </div>
            ) : null}
          </header>

          {contextNav ? <ProductNav items={contextNav} variant="context" label="Forms navigation" /> : null}

          <div className="p-5 sm:p-7">
            <ProductBreadcrumbs />
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
