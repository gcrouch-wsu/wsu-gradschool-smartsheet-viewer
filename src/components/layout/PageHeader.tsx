import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, eyebrow = "Workspace", actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-wsu-crimson">{eyebrow}</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--wsu-ink)]">{title}</h2>
        {description ? <p className="mt-2 text-sm text-[color:var(--wsu-muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
