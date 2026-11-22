"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/forms/admin/AdminCard";
import { useConfirmDialog } from "@/components/ui/ConfirmModal";
import { Modal } from "@/components/ui/Modal";
import { ProductTourControls } from "@/components/ui/ProductTourHost";
import {
  WORKFLOWS_TOUR_STEPS,
  WORKFLOWS_TOUR_STORAGE_KEY,
} from "@/components/workflows/workflows-tour";
import { WorkflowEditorForm } from "@/components/workflows/WorkflowEditorForm";
import { WorkflowList } from "@/components/workflows/WorkflowList";
import { WorkflowTemplatePicker } from "@/components/workflows/WorkflowTemplatePicker";
import {
  workflowPrimaryBtnClass,
  workflowSecondaryBtnClass,
  type WorkflowSheetColumn,
} from "@/components/workflows/shared";
import type { WorkflowRecord, WorkflowRunRecord, WorkflowTemplate } from "@/lib/workflows/types";

interface WorkflowsPayload {
  workflows: WorkflowRecord[];
  failures?: WorkflowRunRecord[];
  catalog: Array<{ id: string; label: string; templates: WorkflowTemplate[] }>;
  sheetId?: string;
  people?: string[];
  available?: boolean;
  notice?: string;
}

export function WorkflowsWorkspace({
  sheetId,
  sourceId,
  sourceLabel,
}: {
  sheetId: string;
  sourceId?: string;
  sourceLabel?: string;
}) {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [payload, setPayload] = useState<WorkflowsPayload | null>(null);
  const [sheetName, setSheetName] = useState("");
  const [error, setError] = useState("");
  const [columns, setColumns] = useState<WorkflowSheetColumn[]>([]);
  const [draft, setDraft] = useState<WorkflowRecord | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  async function load() {
    const res = await fetch(
      `/api/forms/workflows?sheetId=${encodeURIComponent(sheetId)}&people=1`,
      { cache: "no-store" },
    );
    const data = (await res.json()) as WorkflowsPayload & { error?: string; message?: string };
    if (!res.ok) throw new Error(data.error || data.message || "Could not load workflows.");
    setPayload({ ...data, sheetId });
    const sheet = await fetch(`/api/forms/sheet-view?sheetId=${encodeURIComponent(sheetId)}`);
    const sheetData = (await sheet.json()) as { columns?: WorkflowSheetColumn[]; sheetName?: string };
    setColumns(sheet.ok ? sheetData.columns ?? [] : []);
    setSheetName(sheet.ok ? sheetData.sheetName ?? "" : "");
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load workflows."));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when sheet changes
  }, [sheetId]);

  const people = payload?.people ?? [];
  const contactColumns = useMemo(
    () => columns.filter((col) => /contact/i.test(col.type)),
    [columns],
  );

  function startFromTemplate(template: WorkflowTemplate) {
    setNotice("");
    setError("");
    setDraft({
      id: "",
      sheetId,
      name: template.defaults.name,
      enabled: false,
      templateKind: template.kind,
      createdByEmail: null,
      trigger: { ...template.defaults.trigger },
      conditions: [...template.defaults.conditions],
      action: {
        ...template.defaults.action,
        channels: template.defaults.action.channels ?? ["in_app"],
        recipients: { ...template.defaults.action.recipients },
      },
      createdAt: "",
      updatedAt: "",
    });
  }

  function editExisting(workflow: WorkflowRecord) {
    setNotice("");
    setError("");
    setDraft({
      ...workflow,
      action: {
        ...workflow.action,
        channels: workflow.action.channels ?? ["in_app"],
        recipients: { ...workflow.action.recipients },
      },
    });
  }

  async function save(nextEnabled = draft?.enabled ?? false) {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      const body = {
        ...draft,
        enabled: nextEnabled,
        sheetId,
        action: {
          ...draft.action,
          channels: draft.action.channels ?? ["in_app"],
        },
      };
      const res = await fetch(draft.id ? `/api/forms/workflows/${draft.id}` : "/api/forms/workflows", {
        method: draft.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { workflow?: WorkflowRecord; error?: string };
      if (!res.ok) throw new Error(data.error || "Could not save.");
      setDraft(null);
      setNotice(
        nextEnabled
          ? "Workflow enabled. A failure stays on this list and retries after 60 seconds."
          : "Workflow saved as a draft.",
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const confirmed = await confirm({
      title: "Delete workflow",
      message: "Delete this workflow?",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    await fetch(`/api/forms/workflows/${id}`, { method: "DELETE" });
    if (draft?.id === id) setDraft(null);
    await load();
  }

  async function preview(id: string) {
    const res = await fetch(`/api/forms/workflows/${id}/preview`, { method: "POST" });
    const data = (await res.json()) as { error?: string; email?: string; message?: string };
    if (!res.ok) {
      setError(data.error || "Preview failed.");
      return;
    }
    setNotice(
      data.message ||
        `Preview sent to ${data.email}. Open Notifications to read it.`,
    );
  }

  const sheetHref = sourceId
    ? `/admin/sources/${encodeURIComponent(sourceId)}/sheet`
    : "/admin/sources";
  const workflows = payload?.workflows ?? [];
  const canCreate = Boolean(payload && payload.available !== false && (payload.catalog?.length ?? 0) > 0);

  function openPicker() {
    if (!canCreate) return;
    setPickerOpen(true);
  }

  return (
    <div className="space-y-5">
      {confirmDialog}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0" data-tour="ww-heading">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-crimson)]">
            Workflows
          </p>
          <h1 className="mt-1 truncate font-serif text-3xl leading-tight text-[color:var(--wsu-ink)]">
            {sourceLabel || sheetName || `Sheet ${sheetId}`}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--wsu-muted)]">
            Saved workflows live here. A failed run retries after 60 seconds, and notices land in{" "}
            <strong className="font-medium text-[color:var(--wsu-ink)]">Notifications</strong>.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <ProductTourControls storageKey={WORKFLOWS_TOUR_STORAGE_KEY} steps={WORKFLOWS_TOUR_STEPS} />
          <Link href={sheetHref} className={workflowSecondaryBtnClass}>
            Back to sheet
          </Link>
          <button type="button" className={workflowPrimaryBtnClass} data-tour="ww-new" disabled={!canCreate} onClick={openPicker}>
            New workflow
          </button>
        </div>
      </div>

      {error ? <Alert text={error} /> : null}
      {notice ? <Alert ok text={notice} /> : null}
      {payload && payload.available === false ? <Alert text={payload.notice || "Workflows need Postgres."} /> : null}

      <div className="lg:grid lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)] lg:items-start lg:gap-5">
        <section className={draft ? "hidden lg:block" : undefined} aria-label="Workflows on this sheet" data-tour="ww-list">
          <div className="overflow-hidden rounded-2xl border border-[color:var(--wsu-border)] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[color:var(--wsu-border)] bg-[color-mix(in_srgb,var(--wsu-stone)_55%,white)] px-4 py-3">
              <h2 className="text-sm font-medium text-[color:var(--wsu-ink)]">On this sheet</h2>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-[color:var(--wsu-muted)]">
                {workflows.length}
              </span>
            </div>
            <div className="p-2">
              {payload ? (
                <WorkflowList
                  workflows={workflows}
                  failures={payload.failures ?? []}
                  selectedId={draft?.id || null}
                  onEdit={editExisting}
                  onPreview={(id) => void preview(id)}
                  onDelete={(id) => void remove(id)}
                  onChanged={() => void load().catch(() => undefined)}
                />
              ) : (
                <p className="px-3 py-10 text-center text-sm text-[color:var(--wsu-muted)]">Loading workflows…</p>
              )}
            </div>
          </div>
        </section>

        <section className={draft ? undefined : "hidden lg:block"} aria-label="Workflow editor" data-tour="ww-editor">
          {draft ? (
            <div id="workflow-editor">
              <button
                type="button"
                className="mb-3 inline-flex items-center text-sm font-medium text-[color:var(--wsu-crimson)] lg:hidden"
                onClick={() => setDraft(null)}
              >
                Back to workflows
              </button>
              <WorkflowEditorForm
                draft={draft}
                columns={columns}
                contactColumns={contactColumns}
                people={people}
                saving={saving}
                onChange={setDraft}
                onCancel={() => setDraft(null)}
                onSaveDraft={() => void save(false)}
                onSaveAndEnable={() => void save(true)}
              />
            </div>
          ) : (
            <StudioStage
              hasWorkflows={workflows.length > 0}
              loading={!payload && !error}
              disabled={!canCreate}
              onNew={openPicker}
            />
          )}
        </section>
      </div>

      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Choose a template"
        description="The template opens in the editor. Nothing runs until you save and enable it."
        size="lg"
      >
        <WorkflowTemplatePicker
          catalog={payload?.catalog ?? []}
          onUse={(template) => {
            setPickerOpen(false);
            startFromTemplate(template);
          }}
        />
      </Modal>
    </div>
  );
}

function StudioStage({
  hasWorkflows,
  loading,
  disabled,
  onNew,
}: {
  hasWorkflows: boolean;
  loading: boolean;
  disabled: boolean;
  onNew: () => void;
}) {
  if (loading) {
    return (
      <div className="flex min-h-[28rem] items-center rounded-2xl border border-[color:var(--wsu-border)] bg-white px-8 shadow-sm">
        <p className="text-sm text-[color:var(--wsu-muted)]">Loading workflows…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-[color:var(--wsu-border)] bg-white shadow-sm">
      <div className="h-1.5 bg-[color:var(--wsu-crimson)]" aria-hidden />
      <div className="flex flex-1 flex-col justify-center px-8 py-12 sm:px-12">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-crimson)]">
          {hasWorkflows ? "Editor" : "Start here"}
        </p>
        <h2 className="mt-3 max-w-md font-serif text-4xl leading-[1.15] text-[color:var(--wsu-ink)]">
          {hasWorkflows ? "Open a workflow from the list." : "Build the first workflow for this sheet."}
        </h2>
        <p className="mt-4 max-w-sm text-sm leading-6 text-[color:var(--wsu-muted)]">
          {hasWorkflows
            ? "Steps stay beside the form. Templates stay in the chooser until you need another one."
            : "Pick a template, set the trigger, and save a draft. Nothing runs until you enable it."}
        </p>
        <button type="button" className={`${workflowPrimaryBtnClass} mt-8 self-start`} disabled={disabled} onClick={onNew}>
          New workflow
        </button>
      </div>
    </div>
  );
}
