import type { ReactNode } from "react";
import { AppBrandHeader } from "@/components/layout/AppBrandHeader";

export type StatusPageProps = {
  /** Short label above the title, such as "404". */
  code?: string;
  title: string;
  description: string;
  actions?: ReactNode;
};

/** Full-page status screen shared by the 404 page and connection errors. */
export function StatusPage({ code, title, description, actions }: StatusPageProps) {
  return (
    <div className="bg-canvas min-h-screen">
      <AppBrandHeader />
      <main className="px-4 py-6 sm:px-7 sm:py-10 lg:px-8">
        <div className="mx-auto max-w-[1200px]">
          <div className="rounded-[22px] border border-line bg-surface px-5 py-10 shadow-[var(--shadow-md)] sm:px-8">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-crimson">
              {code ?? "Washington State University"}
            </p>
            <h1 className="mt-2 font-serif text-[28px] font-medium leading-tight tracking-[-0.02em] text-ink sm:text-[32px]">
              {title}
            </h1>
            <p className="mt-3 max-w-[58ch] text-sm leading-6 text-sub">{description}</p>
            {actions ? <div className="mt-6 flex flex-wrap gap-3">{actions}</div> : null}
          </div>
        </div>
      </main>
    </div>
  );
}
