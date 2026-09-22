import type { ReactNode } from "react";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/layout/Breadcrumbs";
import { FormBrandHeader } from "@/components/forms/submission/FormBrandHeader";
import { NotificationBell } from "@/components/notifications/NotificationBell";

export function StudentPageFrame({
  breadcrumbs,
  eyebrow = "Graduate School",
  title,
  description,
  actions,
  headingTourId,
  children,
}: {
  breadcrumbs: BreadcrumbItem[];
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  headingTourId?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[color:var(--wsu-stone,#f7f5f2)] text-[color:var(--wsu-ink)]">
      <FormBrandHeader maxWidthClassName="max-w-6xl" />
      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Breadcrumbs items={breadcrumbs} />
          <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div data-tour={headingTourId}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--wsu-crimson)]">{eyebrow}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
              {description ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[color:var(--wsu-muted)]">{description}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : <NotificationBell />}
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}
