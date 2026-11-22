"use client";

import { useEffect, useRef, useState } from "react";
import { WorkflowActionFields } from "@/components/workflows/WorkflowActionFields";
import { WorkflowConditionsFields } from "@/components/workflows/WorkflowConditionsFields";
import { WorkflowStepRail, type WorkflowRailStep } from "@/components/workflows/WorkflowStepRail";
import { WorkflowTriggerFields } from "@/components/workflows/WorkflowTriggerFields";
import {
  workflowPrimaryBtnClass,
  workflowSecondaryBtnClass,
  type WorkflowSheetColumn,
} from "@/components/workflows/shared";
import { getWorkflowTemplate } from "@/lib/workflows/catalog";
import { isRunnableTemplateKind, type WorkflowRecord, type WorkflowTrigger } from "@/lib/workflows/types";

const STEPS: Array<WorkflowRailStep & { heading: string; description: string }> = [
  {
    id: "trigger",
    label: "Trigger",
    heading: "When should this run?",
    description: "Name the workflow and choose the sheet event that starts it.",
  },
  {
    id: "conditions",
    label: "Conditions",
    optional: true,
    heading: "Which rows?",
    description: "Leave this empty to include every row that matches the trigger.",
  },
  {
    id: "action",
    label: "Action",
    heading: "What should happen?",
    description: "Choose who is notified, what changes on the sheet, or where the row goes.",
  },
  {
    id: "review",
    label: "Review",
    heading: "Review and save",
    description: "Check the setup, then save a draft or turn the workflow on.",
  },
];

const EVENT_LABEL: Record<WorkflowTrigger["event"], string> = {
  row_created: "A row is added",
  row_updated: "A row changes",
  columns_changed: "Specific columns change",
};

function columnTitle(columns: WorkflowSheetColumn[], id?: number): string {
  if (!id) return "";
  return columns.find((column) => column.id === id)?.title ?? `Column ${id}`;
}

function triggerSummary(draft: WorkflowRecord, columns: WorkflowSheetColumn[]): string {
  const parts = [EVENT_LABEL[draft.trigger.event] ?? draft.trigger.event];
  if (draft.trigger.event === "columns_changed") {
    const names = (draft.trigger.columnIds ?? [])
      .map((id) => columnTitle(columns, id))
      .filter(Boolean);
    parts.push(names.length ? `Watched columns: ${names.join(", ")}` : "No columns selected");
  }
  if (draft.trigger.delivery === "batched" || draft.templateKind === "request_update_weekly") {
    const day = draft.trigger.schedule?.day || "Every day";
    const time = draft.trigger.schedule?.time || "09:00";
    parts.push(`Once a day, grouped (${day} at ${time})`);
  } else {
    parts.push("Sends immediately");
  }
  return parts.join(". ");
}

function conditionsSummary(draft: WorkflowRecord, columns: WorkflowSheetColumn[]): string {
  if (draft.conditions.length === 0) return "Every row that matches the trigger.";
  const names = draft.conditions
    .map((condition) => condition.columnTitle || columnTitle(columns, condition.columnId))
    .filter(Boolean);
  const count = `${draft.conditions.length} filter${draft.conditions.length === 1 ? "" : "s"}`;
  return names.length ? `${count}: ${names.join(", ")}.` : `${count}.`;
}

function actionSummary(draft: WorkflowRecord, columns: WorkflowSheetColumn[]): string {
  const template = getWorkflowTemplate(draft.templateKind);
  const parts = [template?.title ?? draft.action.kind];
  const emails = draft.action.recipients?.userEmails?.filter(Boolean) ?? [];
  if (emails.length) parts.push(emails.join(", "));
  const contact = columnTitle(columns, draft.action.recipients?.contactColumnId);
  if (contact) parts.push(`Contact column: ${contact}`);
  if (draft.action.channels?.length) parts.push(draft.action.channels.join(", "));
  if (draft.action.targetSheetId?.trim()) parts.push(`Destination sheet ${draft.action.targetSheetId.trim()}`);
  const column = columnTitle(columns, draft.action.columnId);
  if (column) parts.push(column);
  if (draft.action.value?.trim()) parts.push(draft.action.value.trim());
  return parts.join(". ");
}

/** Wizard editor: the step rail stays visible and one step fills the panel. */
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
  const [activeIndex, setActiveIndex] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const skipFocus = useRef(true);
  const canEnable = isRunnableTemplateKind(draft.templateKind);
  const step = STEPS[activeIndex] ?? STEPS[0];
  const lastIndex = STEPS.length - 1;
  const templateTitle = getWorkflowTemplate(draft.templateKind)?.title ?? draft.templateKind;
  const eyebrow = draft.id ? "Editing" : "New workflow";

  useEffect(() => {
    if (skipFocus.current) return;
    headingRef.current?.focus();
  }, [activeIndex]);

  function selectStep(index: number) {
    skipFocus.current = false;
    setActiveIndex(index);
  }

  const review = [
    { label: "Name", value: draft.name.trim() || "Untitled workflow" },
    { label: "Trigger", value: triggerSummary(draft, columns) },
    { label: "Conditions", value: conditionsSummary(draft, columns) },
    { label: "Action", value: actionSummary(draft, columns) },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-[color:var(--wsu-border)] bg-white shadow-sm">
      <div className="border-b border-[color:var(--wsu-border)] bg-[color-mix(in_srgb,var(--wsu-stone)_45%,white)] lg:hidden">
        <p className="px-4 pt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-crimson)]">
          {eyebrow}
        </p>
        <p className="mt-1 truncate px-4 font-serif text-lg leading-snug text-[color:var(--wsu-ink)]">
          {draft.name.trim() || "Untitled workflow"}
        </p>
        <p className="mt-0.5 truncate px-4 pb-1 text-xs text-[color:var(--wsu-muted)]">{templateTitle}</p>
        <WorkflowStepRail
          steps={STEPS}
          activeIndex={activeIndex}
          onSelect={selectStep}
          eyebrow={eyebrow}
          name={draft.name}
          templateTitle={templateTitle}
        />
      </div>
      <div className="lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
        <div className="hidden bg-[color-mix(in_srgb,var(--wsu-stone)_55%,white)] lg:sticky lg:top-0 lg:block lg:self-start lg:border-r lg:border-[color:var(--wsu-border)]">
          <WorkflowStepRail
            steps={STEPS}
            activeIndex={activeIndex}
            onSelect={selectStep}
            eyebrow={eyebrow}
            name={draft.name}
            templateTitle={templateTitle}
          />
        </div>

        <div className="flex min-w-0 flex-col">
          <div className="px-5 py-6 sm:px-7">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="font-serif text-2xl leading-tight tracking-tight text-[color:var(--wsu-ink)] outline-none"
            >
              {step.heading}
              {step.optional ? (
                <span className="font-normal text-[color:var(--wsu-muted)]">
                  {" "}
                  - <span className="italic">optional</span>
                </span>
              ) : null}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--wsu-muted)]">{step.description}</p>

            <div className="mt-6">
              {step.id === "trigger" ? (
                <WorkflowTriggerFields
                  name={draft.name}
                  trigger={draft.trigger}
                  columns={columns}
                  weekly={draft.templateKind === "request_update_weekly"}
                  onName={(name) => onChange({ ...draft, name })}
                  onTrigger={(trigger) => onChange({ ...draft, trigger })}
                />
              ) : null}

              {step.id === "conditions" ? (
                <WorkflowConditionsFields
                  conditions={draft.conditions}
                  columns={columns}
                  onChange={(conditions) => onChange({ ...draft, conditions })}
                />
              ) : null}

              {step.id === "action" ? (
                <WorkflowActionFields
                  action={draft.action}
                  templateKind={draft.templateKind}
                  columns={columns}
                  contactColumns={contactColumns}
                  people={people}
                  runnable={canEnable}
                  onChange={(action) => onChange({ ...draft, action })}
                />
              ) : null}

              {step.id === "review" ? (
                <dl className="divide-y divide-[color:var(--wsu-border)] rounded-xl border border-[color:var(--wsu-border)]">
                  {review.map((row) => (
                    <div key={row.label} className="grid gap-1 px-4 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
                      <dt className="text-sm font-medium text-[color:var(--wsu-ink)]">{row.label}</dt>
                      <dd className="text-sm leading-6 text-[color:var(--wsu-muted)]">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          </div>

          <div className="sticky bottom-0 z-10 mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--wsu-border)] bg-white/95 px-5 py-3 backdrop-blur sm:px-7">
            <button type="button" className={workflowSecondaryBtnClass} disabled={saving} onClick={onCancel}>
              Cancel
            </button>
            <div className="flex flex-wrap gap-2">
              {activeIndex > 0 ? (
                <button
                  type="button"
                  className={workflowSecondaryBtnClass}
                  disabled={saving}
                  onClick={() => selectStep(activeIndex - 1)}
                >
                  Back
                </button>
              ) : null}
              {activeIndex < lastIndex ? (
                <button
                  type="button"
                  className={workflowPrimaryBtnClass}
                  disabled={saving}
                  onClick={() => selectStep(activeIndex + 1)}
                >
                  Next
                </button>
              ) : (
                <>
                  <button type="button" className={workflowSecondaryBtnClass} disabled={saving} onClick={onSaveDraft}>
                    {saving ? "Saving…" : "Save draft"}
                  </button>
                  {canEnable ? (
                    <button type="button" className={workflowPrimaryBtnClass} disabled={saving} onClick={onSaveAndEnable}>
                      {saving ? "Saving…" : "Save and enable"}
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
