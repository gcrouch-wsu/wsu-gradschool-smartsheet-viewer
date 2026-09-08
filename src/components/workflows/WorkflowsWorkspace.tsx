"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Alert, inputClass, primaryBtnClass, secondaryBtnClass } from "@/components/forms/admin/AdminCard";
import { FormsWorkspaceChrome } from "@/components/forms/layout/FormsWorkspaceChrome";
import { WorkflowTemplateDetailsModal } from "@/components/workflows/WorkflowTemplateDetailsModal";
import { FILTER_OPERATOR_OPTIONS } from "@/lib/config/options";
import type { ViewFilterConfig } from "@/lib/config/types";
import type { WorkflowAction, WorkflowRecord, WorkflowTemplate, WorkflowTrigger } from "@/lib/workflows/types";

interface SheetColumn {
  id: number;
  title: string;
  type: string;
}

interface WorkflowsPayload {
  workflows: WorkflowRecord[];
  catalog: Array<{ id: string; label: string; templates: WorkflowTemplate[] }>;
  sheetId?: string;
  people?: string[];
  available?: boolean;
  notice?: string;
}

function emptyFilter(): ViewFilterConfig {
  return { columnId: undefined, columnTitle: "", op: "equals", value: "" };
}

export function WorkflowsWorkspace() {
  const [payload, setPayload] = useState<WorkflowsPayload | null>(null);
  const [error, setError] = useState("");
  const [columns, setColumns] = useState<SheetColumn[]>([]);
  const [details, setDetails] = useState<WorkflowTemplate | null>(null);
  const [draft, setDraft] = useState<WorkflowRecord | null>(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  async function load() {
    const res = await fetch("/api/forms/workflows?people=1");
    const data = (await res.json()) as WorkflowsPayload & { error?: string; message?: string };
    if (!res.ok) throw new Error(data.error || data.message || "Could not load workflows.");
    setPayload(data);
    if (data.sheetId) {
      const sheet = await fetch(`/api/forms/sheet-view?sheetId=${encodeURIComponent(data.sheetId)}`);
      const sheetData = (await sheet.json()) as { columns?: SheetColumn[] };
      setColumns(sheet.ok ? sheetData.columns ?? [] : []);
    }
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load workflows."));
  }, []);

  const people = payload?.people ?? [];
  const contactColumns = useMemo(
    () => columns.filter((col) => /contact/i.test(col.type)),
    [columns],
  );

  function startFromTemplate(template: WorkflowTemplate) {
    setDetails(null);
    setStep(0);
    setDraft({
      id: "",
      sheetId: payload?.sheetId ?? "",
      name: template.defaults.name,
      enabled: false,
      templateKind: template.kind,
      createdByEmail: null,
      trigger: { ...template.defaults.trigger },
      conditions: [...template.defaults.conditions],
      action: { ...template.defaults.action, recipients: { ...template.defaults.action.recipients } },
      createdAt: "",
      updatedAt: "",
    });
  }

  function editExisting(workflow: WorkflowRecord) {
    setDraft({ ...workflow, action: { ...workflow.action, recipients: { ...workflow.action.recipients } } });
    setStep(0);
  }

  async function save(nextEnabled = draft?.enabled ?? false) {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      const body = {
        ...draft,
        enabled: nextEnabled,
        sheetId: payload?.sheetId || draft.sheetId,
      };
      const res = await fetch(draft.id ? `/api/forms/workflows/${draft.id}` : "/api/forms/workflows", {
        method: draft.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { workflow?: WorkflowRecord; error?: string };
      if (!res.ok) throw new Error(data.error || "Could not save.");
      setDraft(null);
      setNotice(nextEnabled ? "Workflow enabled." : "Workflow saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this workflow?")) return;
    await fetch(`/api/forms/workflows/${id}`, { method: "DELETE" });
    await load();
  }

  async function preview(id: string) {
    const res = await fetch(`/api/forms/workflows/${id}/preview`, { method: "POST" });
    const data = (await res.json()) as { error?: string; email?: string };
    if (!res.ok) {
      setError(data.error || "Preview failed.");
      return;
    }
    setNotice(`Preview sent to ${data.email}. Open Notifications to read it.`);
  }

  return (
    <FormsWorkspaceChrome>
      <div className="space-y-6">
        <div className="rounded-xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/40 px-4 py-3 text-sm text-[color:var(--wsu-muted)]">
          Smartsheet automations are still sending emails for this sheet until you turn them off.{" "}
          <Link href="/forms/manage" className="font-medium text-[color:var(--wsu-crimson)]">
            Turn them off from Manage
          </Link>{" "}
          when in-app notifications are ready. Grid Approve/Decline is unchanged.
        </div>
        {error ? <Alert text={error} /> : null}
        {notice ? <Alert ok text={notice} /> : null}
        {payload && payload.available === false ? <Alert text={payload.notice || "Workflows need Postgres."} /> : null}

        <section className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--wsu-crimson)]">Create</p>
            <h2 className="mt-1 text-lg font-medium text-[color:var(--wsu-ink)]">Choose a workflow template</h2>
          </div>
          {(payload?.catalog ?? []).map((group) => (
            <div key={group.id}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--wsu-crimson)]">{group.label}</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.templates.map((template) => (
                  <button
                    key={template.kind}
                    type="button"
                    onClick={() => setDetails(template)}
                    className="rounded-xl border border-[color:var(--wsu-border)] bg-white p-4 text-left transition hover:border-[var(--crimson-line)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-[color:var(--wsu-ink)]">{template.title}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          template.runnable ? "bg-emerald-50 text-emerald-800" : "bg-[color:var(--wsu-stone)] text-[color:var(--wsu-muted)]"
                        }`}
                      >
                        {template.runnable ? "Ready" : "Later plan"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[color:var(--wsu-muted)]">{template.summary}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-[color:var(--wsu-ink)]">Workflows on this sheet</h2>
          {!payload?.workflows?.length ? (
            <p className="rounded-xl border border-[color:var(--wsu-border)] bg-white px-4 py-6 text-center text-sm text-[color:var(--wsu-muted)]">
              No workflows yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {payload.workflows.map((workflow) => (
                <li key={workflow.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--wsu-border)] bg-white px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[color:var(--wsu-ink)]">{workflow.name}</p>
                    <p className="text-xs text-[color:var(--wsu-muted)]">
                      {workflow.templateKind}
                      {workflow.createdByEmail ? ` · ${workflow.createdByEmail}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${workflow.enabled ? "bg-emerald-50 text-emerald-800" : "bg-[color:var(--wsu-stone)] text-[color:var(--wsu-muted)]"}`}>
                      {workflow.enabled ? "Enabled" : "Draft — later plan or off"}
                    </span>
                    <button type="button" className={secondaryBtnClass} onClick={() => editExisting(workflow)}>Edit</button>
                    {workflow.templateKind === "alert" && workflow.id ? (
                      <button type="button" className={secondaryBtnClass} onClick={() => void preview(workflow.id)}>Preview</button>
                    ) : null}
                    <button type="button" className={secondaryBtnClass} onClick={() => void remove(workflow.id)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <WorkflowTemplateDetailsModal template={details} onClose={() => setDetails(null)} onUse={startFromTemplate} />

      {draft ? (
        <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-[color:var(--wsu-border)] bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-[color:var(--wsu-border)] px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--wsu-crimson)]">
                  {["Trigger", "Conditions", "Action"][step]}
                </p>
                <h2 className="mt-1 text-base font-medium text-[color:var(--wsu-ink)]">{draft.name}</h2>
              </div>
              <button type="button" className={secondaryBtnClass} onClick={() => setDraft(null)}>Close</button>
            </div>
            <div className="space-y-4 p-5">
              {step === 0 ? (
                <TriggerStep
                  name={draft.name}
                  trigger={draft.trigger}
                  columns={columns}
                  weekly={draft.templateKind === "request_update_weekly"}
                  onName={(name) => setDraft({ ...draft, name })}
                  onTrigger={(trigger) => setDraft({ ...draft, trigger })}
                />
              ) : null}
              {step === 1 ? (
                <ConditionsStep
                  conditions={draft.conditions}
                  columns={columns}
                  onChange={(conditions) => setDraft({ ...draft, conditions })}
                />
              ) : null}
              {step === 2 ? (
                <ActionStep
                  action={draft.action}
                  templateKind={draft.templateKind}
                  columns={columns}
                  contactColumns={contactColumns}
                  people={people}
                  runnable={draft.templateKind === "alert"}
                  onChange={(action) => setDraft({ ...draft, action })}
                />
              ) : null}
            </div>
            <div className="flex flex-wrap justify-between gap-2 border-t border-[color:var(--wsu-border)] px-5 py-4">
              <button type="button" className={secondaryBtnClass} disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Back</button>
              <div className="flex gap-2">
                {step < 2 ? (
                  <button type="button" className={primaryBtnClass} onClick={() => setStep((s) => s + 1)}>Next</button>
                ) : (
                  <>
                    <button type="button" className={secondaryBtnClass} disabled={saving} onClick={() => void save(false)}>
                      {saving ? "Saving…" : "Save draft"}
                    </button>
                    {draft.templateKind === "alert" ? (
                      <button type="button" className={primaryBtnClass} disabled={saving} onClick={() => void save(true)}>
                        {saving ? "Saving…" : "Save and enable"}
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </FormsWorkspaceChrome>
  );
}

function TriggerStep({
  name,
  trigger,
  columns,
  weekly,
  onName,
  onTrigger,
}: {
  name: string;
  trigger: WorkflowTrigger;
  columns: SheetColumn[];
  weekly: boolean;
  onName: (name: string) => void;
  onTrigger: (trigger: WorkflowTrigger) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="font-medium text-[color:var(--wsu-ink)]">Name</span>
        <input className={`${inputClass} mt-1`} value={name} onChange={(e) => onName(e.target.value)} />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-[color:var(--wsu-ink)]">Sheet change</span>
        <select
          className={`${inputClass} mt-1`}
          value={trigger.event}
          onChange={(e) => onTrigger({ ...trigger, event: e.target.value as WorkflowTrigger["event"] })}
        >
          <option value="row_created">Row added</option>
          <option value="row_updated">Row changed</option>
          <option value="columns_changed">Specific columns changed</option>
        </select>
      </label>
      {trigger.event === "columns_changed" ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-[color:var(--wsu-ink)]">Watched columns</legend>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-[color:var(--wsu-border)] p-2">
            {columns.map((col) => {
              const checked = trigger.columnIds?.includes(col.id) ?? false;
              return (
                <label key={col.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const current = new Set(trigger.columnIds ?? []);
                      if (e.target.checked) current.add(col.id);
                      else current.delete(col.id);
                      onTrigger({ ...trigger, columnIds: [...current] });
                    }}
                  />
                  {col.title}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}
      <p className="text-xs text-[color:var(--wsu-muted)]">Alerts send immediately. Batched delivery comes in a later plan.</p>
      {weekly ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-[color:var(--wsu-ink)]">Day</span>
            <input
              className={`${inputClass} mt-1`}
              value={trigger.schedule?.day ?? "Monday"}
              onChange={(e) => onTrigger({ ...trigger, schedule: { ...trigger.schedule, day: e.target.value } })}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[color:var(--wsu-ink)]">Time</span>
            <input
              className={`${inputClass} mt-1`}
              value={trigger.schedule?.time ?? "09:00"}
              onChange={(e) => onTrigger({ ...trigger, schedule: { ...trigger.schedule, time: e.target.value } })}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

function ConditionsStep({
  conditions,
  columns,
  onChange,
}: {
  conditions: ViewFilterConfig[];
  columns: SheetColumn[];
  onChange: (conditions: ViewFilterConfig[]) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[color:var(--wsu-muted)]">Optional. All conditions must match. Use is after today for future start dates.</p>
      {conditions.map((filter, index) => (
        <div key={index} className="grid gap-2 rounded-xl border border-[color:var(--wsu-border)] p-3 md:grid-cols-[1fr_160px_1fr_auto]">
          <select
            className={inputClass}
            value={filter.columnId ?? ""}
            onChange={(e) => {
              const col = columns.find((item) => item.id === Number(e.target.value));
              const next = [...conditions];
              next[index] = { ...filter, columnId: col?.id, columnTitle: col?.title ?? "", columnType: col?.type };
              onChange(next);
            }}
          >
            <option value="">Column</option>
            {columns.map((col) => (
              <option key={col.id} value={col.id}>{col.title}</option>
            ))}
          </select>
          <select
            className={inputClass}
            value={filter.op}
            onChange={(e) => {
              const next = [...conditions];
              next[index] = { ...filter, op: e.target.value as ViewFilterConfig["op"] };
              onChange(next);
            }}
          >
            {FILTER_OPERATOR_OPTIONS.map((op) => (
              <option key={op} value={op}>{op.replaceAll("_", " ")}</option>
            ))}
          </select>
          <input
            className={inputClass}
            value={String(filter.value ?? "")}
            placeholder="Value or today"
            onChange={(e) => {
              const next = [...conditions];
              next[index] = { ...filter, value: e.target.value };
              onChange(next);
            }}
          />
          <button
            type="button"
            className={secondaryBtnClass}
            onClick={() => onChange(conditions.filter((_, i) => i !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      <button type="button" className={secondaryBtnClass} onClick={() => onChange([...conditions, emptyFilter()])}>
        Add condition
      </button>
    </div>
  );
}

function ActionStep({
  action,
  templateKind,
  columns,
  contactColumns,
  people,
  runnable,
  onChange,
}: {
  action: WorkflowAction;
  templateKind: string;
  columns: SheetColumn[];
  contactColumns: SheetColumn[];
  people: string[];
  runnable: boolean;
  onChange: (action: WorkflowAction) => void;
}) {
  const emails = action.recipients?.userEmails ?? [];
  return (
    <div className="space-y-3">
      {!runnable ? (
        <p className="rounded-lg bg-[color:var(--wsu-stone)] px-3 py-2 text-xs text-[color:var(--wsu-muted)]">
          You can configure this now; it will not run until a later plan.
        </p>
      ) : null}
      {templateKind === "alert" ? (
        <>
          <label className="block text-sm">
            <span className="font-medium text-[color:var(--wsu-ink)]">Specific people</span>
            <select
              className={`${inputClass} mt-1`}
              multiple
              value={emails}
              onChange={(e) => {
                const selected = [...e.target.selectedOptions].map((opt) => opt.value);
                onChange({ ...action, recipients: { ...action.recipients, userEmails: selected } });
              }}
            >
              {people.map((email) => (
                <option key={email} value={email}>{email}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[color:var(--wsu-ink)]">Or type emails</span>
            <input
              className={`${inputClass} mt-1`}
              value={emails.join(", ")}
              onChange={(e) =>
                onChange({
                  ...action,
                  recipients: {
                    ...action.recipients,
                    userEmails: e.target.value.split(",").map((part) => part.trim()).filter(Boolean),
                  },
                })
              }
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[color:var(--wsu-ink)]">People in a Contact cell</span>
            <select
              className={`${inputClass} mt-1`}
              value={action.recipients?.contactColumnId ?? ""}
              onChange={(e) =>
                onChange({
                  ...action,
                  recipients: {
                    ...action.recipients,
                    contactColumnId: e.target.value ? Number(e.target.value) : undefined,
                  },
                })
              }
            >
              <option value="">None</option>
              {contactColumns.map((col) => (
                <option key={col.id} value={col.id}>{col.title}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[color:var(--wsu-ink)]">Title</span>
            <input className={`${inputClass} mt-1`} value={action.title ?? ""} onChange={(e) => onChange({ ...action, title: e.target.value })} />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[color:var(--wsu-ink)]">Body</span>
            <textarea className={`${inputClass} mt-1`} rows={4} value={action.body ?? ""} onChange={(e) => onChange({ ...action, body: e.target.value })} />
          </label>
          <p className="text-xs text-[color:var(--wsu-muted)]">Tokens like {"{{Column Title}}"} are replaced from the row.</p>
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium text-[color:var(--wsu-ink)]">Fields to include</legend>
            <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-[color:var(--wsu-border)] p-2">
              {columns.map((col) => {
                const checked = action.includeColumnIds?.includes(col.id) ?? false;
                return (
                  <label key={col.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const current = new Set(action.includeColumnIds ?? []);
                        if (e.target.checked) current.add(col.id);
                        else current.delete(col.id);
                        onChange({ ...action, includeColumnIds: [...current] });
                      }}
                    />
                    {col.title}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </>
      ) : null}
      {(templateKind === "move_row" || templateKind === "copy_row") ? (
        <label className="block text-sm">
          <span className="font-medium text-[color:var(--wsu-ink)]">Destination sheet id</span>
          <input
            className={`${inputClass} mt-1`}
            value={action.targetSheetId ?? ""}
            onChange={(e) => onChange({ ...action, targetSheetId: e.target.value })}
          />
        </label>
      ) : null}
      {templateKind === "change_cell" || templateKind === "record_date" || templateKind === "assign_someone" ? (
        <label className="block text-sm">
          <span className="font-medium text-[color:var(--wsu-ink)]">Column</span>
          <select
            className={`${inputClass} mt-1`}
            value={action.columnId ?? ""}
            onChange={(e) => onChange({ ...action, columnId: e.target.value ? Number(e.target.value) : undefined })}
          >
            <option value="">Select column</option>
            {columns.map((col) => (
              <option key={col.id} value={col.id}>{col.title}</option>
            ))}
          </select>
        </label>
      ) : null}
      {templateKind === "change_cell" ? (
        <label className="block text-sm">
          <span className="font-medium text-[color:var(--wsu-ink)]">Value</span>
          <input className={`${inputClass} mt-1`} value={action.value ?? ""} onChange={(e) => onChange({ ...action, value: e.target.value })} />
        </label>
      ) : null}
    </div>
  );
}
