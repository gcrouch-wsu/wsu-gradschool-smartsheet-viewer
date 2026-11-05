import type { ReactNode } from "react";
import type { ProductNavItem } from "@/lib/product-navigation";
import { AppBrandHeader } from "@/components/layout/AppBrandHeader";
import { ProductBreadcrumbs } from "@/components/layout/ProductBreadcrumbs";
import { ProductNav } from "@/components/layout/ProductNav";

interface ProductShellProps {
  children: ReactNode;
  globalNav: ProductNavItem[];
  contextNav?: ProductNavItem[];
  toolbar?: ReactNode;
}

export function ProductShell({ children, globalNav, contextNav, toolbar }: ProductShellProps) {
  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-canvas">
      <AppBrandHeader
        className="shrink-0"
        actions={toolbar}
        actionsLabel="Account"
      />

      <main className="mx-auto flex min-h-0 w-full max-w-[1200px] flex-1 flex-col px-4 py-6 sm:px-7 sm:py-8">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-line border-b-[3px] border-b-wsu-crimson bg-surface shadow-[var(--shadow-md)]">
          {globalNav.length > 0 || contextNav ? (
            <header className="shrink-0 border-b border-line px-5 py-4 sm:px-8">
              {globalNav.length > 0 ? (
                <ProductNav items={globalNav} label="Product navigation" />
              ) : null}
              {contextNav ? (
                <div className={globalNav.length > 0 ? "mt-3" : undefined}>
                  <ProductNav items={contextNav} variant="context" label="Forms navigation" />
                </div>
              ) : null}
            </header>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-7">
            <ProductBreadcrumbs />
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
