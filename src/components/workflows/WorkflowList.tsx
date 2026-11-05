"use client";

import type { WorkflowRecord } from "@/lib/workflows/types";
import { workflowSecondaryBtnClass } from "@/components/workflows/shared";

export function WorkflowList({
  workflows,
  onEdit,
  onPreview,
  onDelete,
}: {
  workflows: WorkflowRecord[];
  onEdit: (workflow: WorkflowRecord) => void;
  onPreview: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (!workflows.length) {
    return (
      <p className="rounded-2xl border border-dashed border-[color:var(--wsu-border)] bg-white px-4 py-10 text-center text-sm text-[color:var(--wsu-muted)]">
        No workflows yet. Choose a template above to configure one on this page.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {workflows.map((workflow) => (
        <li
          key={workflow.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-3 shadow-sm"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[color:var(--wsu-ink)]">{workflow.name}</p>
            <p className="mt-0.5 text-xs text-[color:var(--wsu-muted)]">
              {workflow.templateKind}
              {workflow.createdByEmail ? ` · ${workflow.createdByEmail}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                workflow.enabled
                  ? "bg-emerald-50 text-emerald-800"
                  : workflow.templateKind === "alert"
                    ? "bg-[color:var(--wsu-stone)] text-[color:var(--wsu-muted)]"
                    : "bg-amber-50 text-amber-900"
              }`}
            >
              {workflow.enabled ? "Enabled" : workflow.templateKind === "alert" ? "Off" : "Draft — later plan"}
            </span>
            <button type="button" className={workflowSecondaryBtnClass} onClick={() => onEdit(workflow)}>
              Edit
            </button>
            {workflow.templateKind === "alert" && workflow.id ? (
              <button type="button" className={workflowSecondaryBtnClass} onClick={() => onPreview(workflow.id)}>
                Send preview
              </button>
            ) : null}
            <button type="button" className={workflowSecondaryBtnClass} onClick={() => onDelete(workflow.id)}>
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
