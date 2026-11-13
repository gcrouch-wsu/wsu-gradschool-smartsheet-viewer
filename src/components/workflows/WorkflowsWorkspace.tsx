"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/forms/admin/AdminCard";
import { useConfirmDialog } from "@/components/ui/ConfirmModal";
import { WorkflowEditorForm } from "@/components/workflows/WorkflowEditorForm";
import { WorkflowList } from "@/components/workflows/WorkflowList";
import { WorkflowTemplatePicker } from "@/components/workflows/WorkflowTemplatePicker";
import {
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
    window.requestAnimationFrame(() => {
      document.getElementById("workflow-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    window.requestAnimationFrame(() => {
      document.getElementById("workflow-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  return (
    <div className="space-y-6">
      {confirmDialog}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--wsu-crimson)]">
            Workflows
          </p>
          <h1 className="mt-1 text-xl font-medium text-[color:var(--wsu-ink)]">
            {sourceLabel || sheetName || `Sheet ${sheetId}`}
          </h1>
        </div>
        <Link href={sheetHref} className={workflowSecondaryBtnClass}>
          Back to sheet
        </Link>
      </div>

      <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/40 px-4 py-3 text-sm text-[color:var(--wsu-muted)]">
        Workflows notify people in the <strong className="font-medium text-[color:var(--wsu-ink)]">Notifications</strong>{" "}
        inbox, and a failed run retries itself after 60 seconds. Open a workflow’s runs to see the error.
      </div>

      {error ? <Alert text={error} /> : null}
      {notice ? <Alert ok text={notice} /> : null}
      {payload && payload.available === false ? <Alert text={payload.notice || "Workflows need Postgres."} /> : null}

      {draft ? (
        <div id="workflow-editor">
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
        <>
          <section className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--wsu-crimson)]">
                Create
              </p>
              <h2 className="mt-1 text-lg font-medium text-[color:var(--wsu-ink)]">Choose a template</h2>
              <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">
                Options and steps stay on this page. Enabled workflows run when their trigger matches.
              </p>
            </div>
            <WorkflowTemplatePicker catalog={payload?.catalog ?? []} onUse={startFromTemplate} />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-[color:var(--wsu-ink)]">Workflows on this sheet</h2>
            <WorkflowList
              workflows={payload?.workflows ?? []}
              failures={payload?.failures ?? []}
              onEdit={editExisting}
              onPreview={(id) => void preview(id)}
              onDelete={(id) => void remove(id)}
              onChanged={() => void load().catch(() => undefined)}
            />
          </section>
        </>
      )}
    </div>
  );
}
