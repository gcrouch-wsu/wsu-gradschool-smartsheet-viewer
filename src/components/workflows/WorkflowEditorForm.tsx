"use client";

import { WorkflowActionFields } from "@/components/workflows/WorkflowActionFields";
import { WorkflowConditionsFields } from "@/components/workflows/WorkflowConditionsFields";
import { WorkflowSection } from "@/components/workflows/WorkflowSection";
import { WorkflowTriggerFields } from "@/components/workflows/WorkflowTriggerFields";
import {
  workflowPrimaryBtnClass,
  workflowSecondaryBtnClass,
  type WorkflowSheetColumn,
} from "@/components/workflows/shared";
import { isRunnableTemplateKind, type WorkflowRecord } from "@/lib/workflows/types";

/** Single-page workflow editor: trigger, conditions, and action all visible. */
export function WorkflowEditorForm({
  draft,
  columns,
  contactColumns,
  people,
  saving,
  onChange,
  onCancel,
  onSaveDraft,
  onSaveAndEnable,
}: {
  draft: WorkflowRecord;
  columns: WorkflowSheetColumn[];
  contactColumns: WorkflowSheetColumn[];
  people: string[];
  saving: boolean;
  onChange: (next: WorkflowRecord) => void;
  onCancel: () => void;
  onSaveDraft: () => void;
  onSaveAndEnable: () => void;
}) {
  const canEnable = isRunnableTemplateKind(draft.templateKind);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/35 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--wsu-crimson)]">
          {draft.id ? "Editing workflow" : "New workflow"}
        </p>
        <h2 className="mt-1 text-lg font-medium text-[color:var(--wsu-ink)]">{draft.name || "Untitled workflow"}</h2>
        <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">
          Configure everything below on one screen. A failed run is listed on the sheet and retries after 60 seconds.
        </p>
      </div>

      <WorkflowSection
        step="1 · Trigger"
        title="When should this run?"
        description="Name the workflow and choose the sheet event that starts it."
      >
        <WorkflowTriggerFields
          name={draft.name}
          trigger={draft.trigger}
          columns={columns}
          weekly={draft.templateKind === "request_update_weekly"}
          onName={(name) => onChange({ ...draft, name })}
          onTrigger={(trigger) => onChange({ ...draft, trigger })}
        />
      </WorkflowSection>

      <WorkflowSection
        step="2 · Conditions"
        title="Which rows?"
        description="Optional filters. Leave empty to include every row that matches the trigger."
      >
        <WorkflowConditionsFields
          conditions={draft.conditions}
          columns={columns}
          onChange={(conditions) => onChange({ ...draft, conditions })}
        />
      </WorkflowSection>

      <WorkflowSection
        step="3 · Action"
        title="What should happen?"
        description={
          "Choose who is notified, what changes on the sheet, or where the row goes."
        }
      >
        <WorkflowActionFields
          action={draft.action}
          templateKind={draft.templateKind}
          columns={columns}
          contactColumns={contactColumns}
          people={people}
          runnable={canEnable}
          onChange={(action) => onChange({ ...draft, action })}
        />
      </WorkflowSection>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--wsu-border)] bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
        <button type="button" className={workflowSecondaryBtnClass} disabled={saving} onClick={onCancel}>
          Cancel
        </button>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={workflowSecondaryBtnClass} disabled={saving} onClick={onSaveDraft}>
            {saving ? "Saving…" : "Save draft"}
          </button>
          {canEnable ? (
            <button type="button" className={workflowPrimaryBtnClass} disabled={saving} onClick={onSaveAndEnable}>
              {saving ? "Saving…" : "Save and enable"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
