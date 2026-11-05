import type { ReactNode } from "react";

/** Reusable labeled section chrome for workflow (and similar) page forms. */
export function WorkflowSection({
  step,
  title,
  description,
  children,
}: {
  step?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5 shadow-sm">
      <header className="mb-4 border-b border-[color:var(--wsu-border)] pb-3">
        {step ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--wsu-crimson)]">
            {step}
          </p>
        ) : null}
        <h2 className="mt-1 text-base font-medium text-[color:var(--wsu-ink)]">{title}</h2>
        {description ? <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}
