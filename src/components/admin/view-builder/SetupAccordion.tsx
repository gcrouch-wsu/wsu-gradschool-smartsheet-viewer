"use client";

import type { ReactNode } from "react";

export function SetupAccordion({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-2xl border border-[color:var(--wsu-border)] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[color:var(--wsu-ink)]">{title}</p>
          {subtitle ? <p className="mt-0.5 text-xs text-[color:var(--wsu-muted)]">{subtitle}</p> : null}
        </div>
        <span
          className="shrink-0 text-[10px] font-medium text-[color:var(--wsu-muted)] transition-transform duration-200 group-open:rotate-180"
          aria-hidden
        >
          ▼
        </span>
      </summary>
      <div className="border-t border-[color:var(--wsu-border)] px-4 py-4">{children}</div>
    </details>
  );
}
