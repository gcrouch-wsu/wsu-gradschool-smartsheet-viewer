"use client";

import { useState } from "react";
import type { WorkflowTemplate } from "@/lib/workflows/types";
import { workflowPrimaryBtnClass } from "@/components/workflows/shared";

export function WorkflowTemplatePicker({
  catalog,
  onUse,
}: {
  catalog: Array<{ id: string; label: string; templates: WorkflowTemplate[] }>;
  onUse: (template: WorkflowTemplate) => void;
}) {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const activeId = catalog.some((group) => group.id === categoryId) ? categoryId : catalog[0]?.id;
  const group = catalog.find((item) => item.id === activeId) ?? catalog[0];

  if (!catalog.length || !group) {
    return <p className="text-sm text-[color:var(--wsu-muted)]">Templates are still loading.</p>;
  }

  return (
    <div>
      <div role="tablist" aria-label="Template categories" className="flex gap-1.5 overflow-x-auto pb-1">
        {catalog.map((item) => {
          const selected = item.id === group.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={[
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--wsu-crimson)]",
                selected
                  ? "bg-[color:var(--wsu-crimson)] text-white"
                  : "bg-[color:var(--wsu-stone)] text-[color:var(--wsu-ink)] hover:bg-[color-mix(in_srgb,var(--wsu-stone)_70%,var(--wsu-border))]",
              ].join(" ")}
              onClick={() => setCategoryId(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <ul className="mt-3 divide-y divide-[color:var(--wsu-border)] overflow-hidden rounded-xl border border-[color:var(--wsu-border)]">
        {group.templates.map((template) => (
          <li key={template.kind} className="flex items-center gap-3 bg-white px-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[color:var(--wsu-ink)]">{template.title}</p>
              <p className="mt-0.5 text-xs leading-5 text-[color:var(--wsu-muted)]">{template.summary}</p>
            </div>
            <button
              type="button"
              className={`${workflowPrimaryBtnClass} shrink-0 px-3 py-1.5 text-xs`}
              onClick={() => onUse(template)}
            >
              Use
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
