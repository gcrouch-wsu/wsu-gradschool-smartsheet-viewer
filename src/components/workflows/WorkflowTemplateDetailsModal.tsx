"use client";

import { Modal } from "@/components/ui/Modal";
import { primaryBtnClass, secondaryBtnClass } from "@/components/forms/admin/AdminCard";
import { IconBell, IconFile, IconGrid } from "@/components/forms/icons";
import { LATER_PLAN_NOTE } from "@/lib/workflows/catalog";
import type { WorkflowTemplate } from "@/lib/workflows/types";

function Diagram({ kind }: { kind: WorkflowTemplate["kind"] }) {
  const Icon = kind === "alert" ? IconBell : kind.includes("row") || kind.includes("copy") || kind.includes("move") ? IconFile : IconGrid;
  return (
    <div className="flex h-full min-h-[180px] items-center justify-center rounded-xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/50 p-6">
      <div className="flex items-center gap-3 text-[color:var(--wsu-ink)]">
        <span className="flex h-14 w-14 items-center justify-center rounded-xl border border-[color:var(--wsu-border)] bg-white">
          <IconFile className="h-6 w-6 text-[color:var(--wsu-crimson)]" />
        </span>
        <span className="h-px w-8 bg-[color:var(--wsu-crimson)]" />
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--wsu-crimson)] text-white">
          <Icon className="h-5 w-5" />
        </span>
        <span className="h-px w-8 bg-[color:var(--wsu-crimson)]" />
        <span className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-[color:var(--wsu-border)] bg-white">
          <IconGrid className="h-6 w-6 text-[color:var(--wsu-muted)]" />
        </span>
      </div>
    </div>
  );
}

export function WorkflowTemplateDetailsModal({
  template,
  onClose,
  onUse,
}: {
  template: WorkflowTemplate | null;
  onClose: () => void;
  onUse: (template: WorkflowTemplate) => void;
}) {
  return (
    <Modal open={Boolean(template)} onClose={onClose} title={template?.title} size="xl">
      {template ? (
        <div className="space-y-5 px-5 py-4">
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <Diagram kind={template.kind} />
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-[color:var(--wsu-ink)]">Great ways to use this template</h3>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-[color:var(--wsu-muted)]">
                  {template.greatWays.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium text-[color:var(--wsu-ink)]">How to use this template</h3>
                <ol className="mt-2 list-decimal space-y-2 pl-4 text-sm text-[color:var(--wsu-muted)]">
                  <li>
                    <span className="font-medium text-[color:var(--wsu-ink)]">Trigger: </span>
                    {template.howTo.trigger}
                  </li>
                  <li>
                    <span className="font-medium text-[color:var(--wsu-ink)]">Optional Conditions: </span>
                    {template.howTo.conditions}
                  </li>
                  <li>
                    <span className="font-medium text-[color:var(--wsu-ink)]">Action: </span>
                    {template.howTo.action}
                  </li>
                </ol>
              </div>
              {!template.runnable ? (
                <p className="rounded-lg bg-[color:var(--wsu-stone)] px-3 py-2 text-xs text-[color:var(--wsu-muted)]">
                  {LATER_PLAN_NOTE}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-[color:var(--wsu-border)] pt-4">
            <button type="button" className={secondaryBtnClass} onClick={onClose}>
              Cancel
            </button>
            <button type="button" className={primaryBtnClass} onClick={() => onUse(template)}>
              Use template
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
