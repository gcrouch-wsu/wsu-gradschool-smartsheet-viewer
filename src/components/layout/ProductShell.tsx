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
    <div className="bg-canvas min-h-screen">
      <AppBrandHeader
        actions={toolbar}
        actionsLabel="Account"
      />

      <main className="px-4 py-6 sm:px-7 sm:py-10 lg:px-8 lg:pb-16">
        <div className="mx-auto max-w-[1200px]">
          <div className="overflow-hidden rounded-[22px] border border-line bg-surface shadow-[var(--shadow-md)]">
            {globalNav.length > 0 || contextNav ? (
              <header className="border-b border-line px-5 py-4 sm:px-8">
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

            <div className="p-5 sm:p-7">
              <ProductBreadcrumbs />
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
