"use client";

import type { WorkflowTemplate } from "@/lib/workflows/types";
import { workflowPrimaryBtnClass, workflowSecondaryBtnClass } from "@/components/workflows/shared";

export function WorkflowTemplatePicker({
  catalog,
  selectedKind,
  onUse,
}: {
  catalog: Array<{ id: string; label: string; templates: WorkflowTemplate[] }>;
  selectedKind?: string | null;
  onUse: (template: WorkflowTemplate) => void;
}) {
  return (
    <div className="space-y-6">
      {catalog.map((group) => (
        <div key={group.id}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--wsu-crimson)]">
            {group.label}
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {group.templates.map((template) => {
              const selected = selectedKind === template.kind;
              return (
                <article
                  key={template.kind}
                  className={[
                    "flex flex-col rounded-2xl border bg-white p-4 text-left shadow-sm transition",
                    selected
                      ? "border-[color:var(--wsu-crimson)] ring-2 ring-[color:var(--wsu-crimson)]/15"
                      : "border-[color:var(--wsu-border)] hover:border-[var(--crimson-line)]",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-medium text-[color:var(--wsu-ink)]">{template.title}</h4>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        template.runnable
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-[color:var(--wsu-stone)] text-[color:var(--wsu-muted)]"
                      }`}
                    >
                      {template.runnable ? "Ready" : "Later"}
                    </span>
                  </div>
                  <p className="mt-2 flex-1 text-xs leading-relaxed text-[color:var(--wsu-muted)]">
                    {template.summary}
                  </p>
                  <ul className="mt-3 space-y-1 text-xs text-[color:var(--wsu-muted)]">
                    <li>
                      <span className="font-medium text-[color:var(--wsu-ink)]">Trigger: </span>
                      {template.howTo.trigger}
                    </li>
                    <li>
                      <span className="font-medium text-[color:var(--wsu-ink)]">Action: </span>
                      {template.howTo.action}
                    </li>
                  </ul>
                  <div className="mt-4">
                    <button
                      type="button"
                      className={template.runnable ? workflowPrimaryBtnClass : workflowSecondaryBtnClass}
                      onClick={() => onUse(template)}
                    >
                      {template.runnable ? "Use template" : "Configure draft"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
