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
import type { WorkflowRecord } from "@/lib/workflows/types";

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
  const canEnable = draft.templateKind === "alert";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/35 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--wsu-crimson)]">
          {draft.id ? "Editing workflow" : "New workflow"}
        </p>
        <h2 className="mt-1 text-lg font-medium text-[color:var(--wsu-ink)]">{draft.name || "Untitled workflow"}</h2>
        <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">
          Configure everything below on one screen. Alert workflows write to Notifications now; email can use the same
          delivery path later.
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
          canEnable
            ? "Choose recipients, message copy, and delivery channels."
            : "Configure the action now; this template will not run until a later plan."
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
