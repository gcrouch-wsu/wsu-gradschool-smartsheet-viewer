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
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-crimson">{eyebrow}</p>
        <h2 className="mt-1 font-serif text-2xl font-medium tracking-[-0.02em] text-ink">{title}</h2>
        {description ? <p className="mt-2 max-w-[65ch] text-[13px] leading-5 text-sub">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
