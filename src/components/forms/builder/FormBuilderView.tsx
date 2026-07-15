"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HeaderCustomTextEditor } from "@/components/admin/HeaderCustomTextEditor";
import { SubmissionFormView } from "@/components/forms/SubmissionFormView";
import { IconPlus } from "@/components/forms/icons";
import type { FormFieldDefinition } from "@/lib/forms/form-field-config";
import { isFieldFormItem, isLayoutFormItem } from "@/lib/forms/form-field-config";
import type { ConditionalRule, SmartsheetColumn } from "@/lib/forms/types";
import {
  type BuilderElementType,
  type BuilderFieldType,
  useFormBuilder,
} from "@/components/forms/builder/useFormBuilder";
import { richTextPlainText } from "@/lib/rendering";

const inputClass =
  "w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm text-[color:var(--wsu-ink)] focus:border-wsu-crimson focus:outline-none focus:ring-1 focus:ring-wsu-crimson";

const secondaryBtn =
  "rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm font-medium text-[color:var(--wsu-ink)] hover:bg-[color:var(--wsu-stone)] disabled:opacity-50";

const primaryBtn =
  "rounded-lg bg-wsu-crimson px-4 py-2 text-sm font-medium text-white hover:bg-wsu-crimson-dark disabled:opacity-60";

const FIELD_PALETTE: { type: BuilderFieldType; label: string; hint: string }[] = [
  { type: "text", label: "Short text", hint: "Single-line answer" },
  { type: "textarea", label: "Long text", hint: "Multi-line answer" },
  { type: "email", label: "Email", hint: "Validated email" },
  { type: "phone", label: "Phone", hint: "Phone number" },
  { type: "number", label: "Number", hint: "Numeric value" },
  { type: "dropdown", label: "Dropdown", hint: "Single picklist" },
  { type: "multiselect", label: "Multi-select", hint: "Choose multiple" },
  { type: "contact", label: "Contact", hint: "Person email" },
  { type: "checkbox", label: "Checkbox", hint: "Yes / no" },
  { type: "date", label: "Date", hint: "Date picker" },
];

const ELEMENT_PALETTE: { type: BuilderElementType; label: string; hint: string }[] = [
  { type: "heading", label: "Heading", hint: "Section title" },
  { type: "description", label: "Description", hint: "Instruction text" },
  { type: "divider", label: "Divider", hint: "Visual separator" },
];

function FormPresentationEditor({
  sheetName,
  formTitle,
  formDescription,
  allowedDomains,
  envAllowedDomains,
  attachmentsEnabled,
  envAttachmentsEnabled,
  formPublic,
  publicUrl,
  onChange,
}: {
  sheetName: string;
  formTitle: string;
  formDescription: string;
  allowedDomains: string[];
  envAllowedDomains: string[];
  attachmentsEnabled: boolean;
  envAttachmentsEnabled: boolean;
  formPublic: boolean;
  publicUrl: string | null;
  onChange: (patch: {
    formTitle?: string;
    formDescription?: string;
    allowedDomains?: string[];
    attachmentsEnabled?: boolean;
  }) => void;
}) {
  const domainsText = allowedDomains.join(", ");
  const envDefault = (envAllowedDomains.length ? envAllowedDomains : ["wsu.edu"]).join(", ");

  return (
    <section className="rounded-xl border border-[color:var(--wsu-border)] bg-white p-4">
      <h2 className="text-sm font-medium text-[color:var(--wsu-ink)]">Form title & description</h2>
      <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">
        Shown at the top of the public form. Next: set domains, then publish from Manage.
      </p>
      <div className="mt-3 space-y-3">
        <div>
          <label className="mb-1 block text-xs text-[color:var(--wsu-muted)]">Title</label>
          <HeaderCustomTextEditor
            value={formTitle}
            placeholder={sheetName}
            compact
            onChange={(html) => onChange({ formTitle: html })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[color:var(--wsu-muted)]">Description</label>
          <HeaderCustomTextEditor
            value={formDescription}
            placeholder="Optional supporting text for submitters"
            onChange={(html) => onChange({ formDescription: html })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[color:var(--wsu-muted)]">Allowed email domains</label>
          <input
            className={inputClass}
            value={domainsText}
            placeholder="wsu.edu"
            onChange={(e) =>
              onChange({
                allowedDomains: e.target.value
                  .split(",")
                  .map((d) => d.trim().toLowerCase())
                  .filter(Boolean),
              })
            }
          />
          <p className="mt-1 text-[11px] text-[color:var(--wsu-muted)]">
            Comma-separated. Default is <span className="font-mono">{envDefault}</span>. Clear and save to use that
            default again.
          </p>
        </div>
        <div>
          <label className="flex items-start gap-2 text-sm text-[color:var(--wsu-ink)]">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-[color:var(--wsu-border)] text-wsu-crimson focus:ring-wsu-crimson"
              checked={attachmentsEnabled}
              onChange={(e) => onChange({ attachmentsEnabled: e.target.checked })}
            />
            <span>
              Allow file uploads
              <span className="mt-0.5 block text-[11px] font-normal text-[color:var(--wsu-muted)]">
                When off, the submit form hides the attachment control. Env default is{" "}
                {envAttachmentsEnabled ? "on" : "off"} (`ATTACHMENTS_ENABLED`).
              </span>
            </span>
          </label>
        </div>
        <div className="rounded-lg border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/40 px-3 py-2 text-xs text-[color:var(--wsu-muted)]">
          {formPublic && publicUrl ? (
            <p>
              Published:{" "}
              <Link href={publicUrl} className="font-medium text-wsu-crimson hover:underline">
                {publicUrl}
              </Link>
            </p>
          ) : (
            <p>Draft — publish from Manage to get a public /f/… URL. Active status is only for /forms testing.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function FieldPalette({ onAdd }: { onAdd: (type: BuilderElementType) => void }) {
  return (
    <section className="rounded-xl border border-[color:var(--wsu-border)] bg-white p-4">
      <h2 className="text-sm font-medium text-[color:var(--wsu-ink)]">Form elements</h2>
      <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">Layout blocks and Smartsheet input fields.</p>

      <h3 className="mt-4 text-xs font-medium uppercase tracking-wide text-[color:var(--wsu-muted)]">Layout</h3>
      <div className="mt-2 space-y-2">
        {ELEMENT_PALETTE.map((item) => (
          <button
            key={item.type}
            type="button"
            onClick={() => onAdd(item.type)}
            className="flex w-full items-start gap-2 rounded-lg border border-[color:var(--wsu-border)] px-3 py-2 text-left hover:border-wsu-crimson/40 hover:bg-[color:var(--wsu-stone)]/50"
          >
            <IconPlus className="mt-0.5 h-4 w-4 shrink-0 text-wsu-crimson" />
            <span>
              <span className="block text-sm font-medium text-[color:var(--wsu-ink)]">{item.label}</span>
              <span className="block text-xs text-[color:var(--wsu-muted)]">{item.hint}</span>
            </span>
          </button>
        ))}
      </div>

      <h3 className="mt-4 text-xs font-medium uppercase tracking-wide text-[color:var(--wsu-muted)]">Fields</h3>
      <div className="mt-2 space-y-2">
        {FIELD_PALETTE.map((item) => (
          <button
            key={item.type}
            type="button"
            onClick={() => onAdd(item.type)}
            className="flex w-full items-start gap-2 rounded-lg border border-[color:var(--wsu-border)] px-3 py-2 text-left hover:border-wsu-crimson/40 hover:bg-[color:var(--wsu-stone)]/50"
          >
            <IconPlus className="mt-0.5 h-4 w-4 shrink-0 text-wsu-crimson" />
            <span>
              <span className="block text-sm font-medium text-[color:var(--wsu-ink)]">{item.label}</span>
              <span className="block text-xs text-[color:var(--wsu-muted)]">{item.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function FieldCanvas({
  fields,
  columns,
  selectedTitle,
  lockedSet,
  onSelect,
  onToggleHidden,
  onReorder,
}: {
  fields: FormFieldDefinition[];
  columns: SmartsheetColumn[];
  selectedTitle: string | null;
  lockedSet: Set<string>;
  onSelect: (title: string) => void;
  onToggleHidden: (title: string, hidden: boolean) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const byTitle = useMemo(() => new Map(columns.map((c) => [c.title.toLowerCase(), c])), [columns]);

  const formFields = fields.filter((f) => !lockedSet.has(f.columnTitle.toLowerCase()) || !f.hiddenOnForm || isLayoutFormItem(f));
  const lockedHidden = fields.filter((f) => isFieldFormItem(f) && lockedSet.has(f.columnTitle.toLowerCase()) && f.hiddenOnForm);

  return (
    <section className="rounded-xl border border-[color:var(--wsu-border)] bg-white p-4">
      <h2 className="text-sm font-medium text-[color:var(--wsu-ink)]">Form layout</h2>
      <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">Drag to reorder. Toggle to include on the public form.</p>
      <ul className="mt-3 space-y-2">
        {formFields.map((field) => {
          const index = fields.findIndex((f) => f.columnTitle === field.columnTitle);
          const layout = isLayoutFormItem(field);
          const col = layout ? null : byTitle.get(field.columnTitle.toLowerCase());
          const locked = !layout && lockedSet.has(field.columnTitle.toLowerCase());
          const selected = selectedTitle === field.columnTitle;
          const label = layout
            ? field.itemKind === "divider"
              ? "Divider"
              : richTextPlainText(field.text ?? "") ||
                (field.itemKind === "heading" ? "Heading" : "Description")
            : field.label || field.columnTitle;
          return (
            <li
              key={field.columnTitle}
              draggable={!locked}
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex === null || dragIndex === index) return;
                onReorder(dragIndex, index);
                setDragIndex(null);
              }}
              className={[
                "flex items-center gap-3 rounded-lg border px-3 py-2",
                selected ? "border-wsu-crimson bg-wsu-crimson/5" : "border-[color:var(--wsu-border)] bg-white",
                field.hiddenOnForm ? "opacity-60" : "",
              ].join(" ")}
            >
              <button type="button" className="cursor-grab text-[color:var(--wsu-muted)]" aria-label="Drag to reorder" disabled={locked}>
                ≡
              </button>
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(field.columnTitle)}>
                <span className="block truncate text-sm font-medium text-[color:var(--wsu-ink)]">{label}</span>
                <span className="block text-xs text-[color:var(--wsu-muted)]">
                  {layout ? `Element · ${field.itemKind}` : `${col?.type ?? "Column"}${field.kindHint ? ` · ${field.kindHint}` : ""}`}
                  {locked ? " · locked" : ""}
                </span>
              </button>
              <label className="flex items-center gap-1.5 text-xs text-[color:var(--wsu-muted)]">
                <input
                  type="checkbox"
                  checked={!field.hiddenOnForm}
                  disabled={locked}
                  onChange={(e) => onToggleHidden(field.columnTitle, !e.target.checked)}
                />
                On form
              </label>
            </li>
          );
        })}
      </ul>
      {lockedHidden.length ? (
        <div className="mt-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-[color:var(--wsu-muted)]">Sheet-only / workflow</h3>
          <ul className="mt-2 space-y-1 text-xs text-[color:var(--wsu-muted)]">
            {lockedHidden.map((f) => (
              <li key={f.columnTitle}>{f.columnTitle}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function FieldInspector({
  field,
  column,
  locked,
  onChange,
  onRename,
  onOptions,
  onDelete,
}: {
  field: FormFieldDefinition | null;
  column: SmartsheetColumn | null;
  locked: boolean;
  onChange: (patch: Partial<FormFieldDefinition>) => void;
  onRename: (title: string) => Promise<void>;
  onOptions: (options: string[]) => Promise<void>;
  onDelete: () => void;
}) {
  const [titleDraft, setTitleDraft] = useState(field?.columnTitle ?? "");
  const [optionsDraft, setOptionsDraft] = useState((column?.options ?? []).join("\n"));
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    setTitleDraft(field?.columnTitle ?? "");
    setOptionsDraft((column?.options ?? []).join("\n"));
    setLocalError("");
  }, [field?.columnTitle, column?.id, column?.options]);

  if (!field) {
    return (
      <section className="rounded-xl border border-[color:var(--wsu-border)] bg-white p-4">
        <h2 className="text-sm font-medium text-[color:var(--wsu-ink)]">Element properties</h2>
        <p className="mt-2 text-sm text-[color:var(--wsu-muted)]">Select a field or layout element on the canvas.</p>
      </section>
    );
  }

  if (isLayoutFormItem(field)) {
    return (
      <section className="space-y-4 rounded-xl border border-[color:var(--wsu-border)] bg-white p-4">
        <div>
          <h2 className="text-sm font-medium text-[color:var(--wsu-ink)]">Element properties</h2>
          <p className="mt-1 text-xs text-[color:var(--wsu-muted)] capitalize">{field.itemKind}</p>
        </div>

        {field.itemKind !== "divider" ? (
          <div>
            <label className="mb-1 block text-xs text-[color:var(--wsu-muted)]">
              {field.itemKind === "heading" ? "Heading text" : "Description text"}
            </label>
            <HeaderCustomTextEditor
              key={field.columnTitle}
              value={field.text ?? ""}
              compact={field.itemKind === "heading"}
              placeholder={
                field.itemKind === "heading"
                  ? "Section heading"
                  : "Add supporting instructions for this section."
              }
              onChange={(html) => onChange({ text: html })}
            />
          </div>
        ) : (
          <p className="text-sm text-[color:var(--wsu-muted)]">Dividers have no text. Drag to place them between fields.</p>
        )}

        <button type="button" onClick={onDelete} className="text-sm font-medium text-red-700 hover:underline">
          Remove element
        </button>
      </section>
    );
  }

  if (!column) {
    return (
      <section className="rounded-xl border border-[color:var(--wsu-border)] bg-white p-4">
        <h2 className="text-sm font-medium text-[color:var(--wsu-ink)]">Field properties</h2>
        <p className="mt-2 text-sm text-[color:var(--wsu-muted)]">Column not found on the sheet.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-[color:var(--wsu-border)] bg-white p-4">
      <div>
        <h2 className="text-sm font-medium text-[color:var(--wsu-ink)]">Field properties</h2>
        <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">{column.type} · ID {column.id}</p>
      </div>

      <div>
        <label htmlFor="builder-col-title" className="mb-1 block text-xs text-[color:var(--wsu-muted)]">
          Column title (Smartsheet)
        </label>
        <div className="flex gap-2">
          <input
            id="builder-col-title"
            className={inputClass}
            value={titleDraft}
            disabled={locked || busy}
            onChange={(e) => setTitleDraft(e.target.value)}
          />
          <button
            type="button"
            className={secondaryBtn}
            disabled={locked || busy || !titleDraft.trim() || titleDraft.trim() === field.columnTitle}
            onClick={async () => {
              setBusy(true);
              setLocalError("");
              try {
                await onRename(titleDraft.trim());
              } catch (e: unknown) {
                setLocalError(e instanceof Error ? e.message : "Rename failed.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Rename
          </button>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-[color:var(--wsu-muted)]">Display label</label>
        <input
          className={inputClass}
          value={field.label ?? ""}
          placeholder={field.columnTitle}
          disabled={locked}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-[color:var(--wsu-muted)]">Help text</label>
        <input
          className={inputClass}
          value={field.helpText ?? ""}
          disabled={locked}
          onChange={(e) => onChange({ helpText: e.target.value })}
        />
      </div>

      {column.type === "TEXT_NUMBER" || column.type === "CONTACT_LIST" || column.type === "PHONE" ? (
        <div>
          <label className="mb-1 block text-xs text-[color:var(--wsu-muted)]">Input kind</label>
          <select
            className={inputClass}
            value={field.kindHint ?? (column.type === "PHONE" ? "phone" : column.type === "CONTACT_LIST" ? "email" : "text")}
            disabled={locked}
            onChange={(e) => onChange({ kindHint: e.target.value as FormFieldDefinition["kindHint"] })}
          >
            <option value="text">Short text</option>
            <option value="textarea">Long text</option>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="number">Number</option>
          </select>
        </div>
      ) : null}

      {column.type !== "CHECKBOX" ? (
        <label className="flex items-center gap-2 text-sm text-[color:var(--wsu-ink)]">
          <input
            type="checkbox"
            checked={Boolean(field.required)}
            disabled={locked}
            onChange={(e) => onChange({ required: e.target.checked })}
          />
          Required on form
        </label>
      ) : null}

      {column.type === "PICKLIST" || column.type === "MULTI_PICKLIST" ? (
        <div>
          <label className="mb-1 block text-xs text-[color:var(--wsu-muted)]">Options (one per line)</label>
          <textarea
            className={`${inputClass} min-h-[6rem]`}
            value={optionsDraft}
            disabled={locked || busy}
            onChange={(e) => setOptionsDraft(e.target.value)}
          />
          <button
            type="button"
            className={`${secondaryBtn} mt-2`}
            disabled={locked || busy}
            onClick={async () => {
              setBusy(true);
              setLocalError("");
              try {
                const options = optionsDraft
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean);
                await onOptions(options);
              } catch (e: unknown) {
                setLocalError(e instanceof Error ? e.message : "Could not update options.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Save options
          </button>
        </div>
      ) : null}

      {localError ? <p className="text-xs text-red-700">{localError}</p> : null}

      {!locked ? (
        <button type="button" onClick={onDelete} className="text-sm font-medium text-red-700 hover:underline">
          Delete field
        </button>
      ) : (
        <p className="text-xs text-[color:var(--wsu-muted)]">Workflow / system columns stay on the sheet but off the public form.</p>
      )}
    </section>
  );
}

function ConditionalRulesEditor({
  rules,
  fields,
  onChange,
}: {
  rules: ConditionalRule[];
  fields: FormFieldDefinition[];
  onChange: (rules: ConditionalRule[]) => void;
}) {
  const titles = fields.filter((f) => isFieldFormItem(f) && !f.hiddenOnForm).map((f) => f.columnTitle);

  function updateRule(index: number, patch: Partial<ConditionalRule>) {
    onChange(rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  }

  return (
    <section className="rounded-xl border border-[color:var(--wsu-border)] bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-[color:var(--wsu-ink)]">Conditional logic</h2>
          <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">Show fields when another field matches a value.</p>
        </div>
        <button
          type="button"
          className={secondaryBtn}
          onClick={() =>
            onChange([
              ...rules,
              {
                whenColumn: titles[0] ?? "",
                equals: [""],
                showColumns: titles.slice(1, 2),
              },
            ])
          }
        >
          Add rule
        </button>
      </div>

      <div className="mt-3 space-y-3">
        {rules.length === 0 ? <p className="text-sm text-[color:var(--wsu-muted)]">No rules yet.</p> : null}
        {rules.map((rule, index) => (
          <div key={index} className="space-y-2 rounded-lg border border-[color:var(--wsu-border)] p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-[color:var(--wsu-muted)]">When field</label>
                <select className={inputClass} value={rule.whenColumn} onChange={(e) => updateRule(index, { whenColumn: e.target.value })}>
                  <option value="">Select…</option>
                  {titles.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[color:var(--wsu-muted)]">Equals (comma-separated)</label>
                <input
                  className={inputClass}
                  value={rule.equals.join(", ")}
                  onChange={(e) =>
                    updateRule(index, {
                      equals: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[color:var(--wsu-muted)]">Show fields</label>
              <div className="flex flex-wrap gap-2">
                {titles
                  .filter((t) => t.toLowerCase() !== rule.whenColumn.toLowerCase())
                  .map((t) => {
                    const checked = rule.showColumns.some((s) => s.toLowerCase() === t.toLowerCase());
                    return (
                      <label key={t} className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--wsu-border)] px-2.5 py-1 text-xs">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...rule.showColumns, t]
                              : rule.showColumns.filter((s) => s.toLowerCase() !== t.toLowerCase());
                            updateRule(index, { showColumns: next });
                          }}
                        />
                        {t}
                      </label>
                    );
                  })}
              </div>
            </div>
            <button
              type="button"
              className="text-xs font-medium text-red-700 hover:underline"
              onClick={() => onChange(rules.filter((_, i) => i !== index))}
            >
              Remove rule
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export function FormBuilderView() {
  const builder = useFormBuilder();
  const [previewOpen, setPreviewOpen] = useState(true);

  if (builder.loading) {
    return <p className="text-sm text-[color:var(--wsu-muted)]">Loading form builder…</p>;
  }

  if (builder.error || !builder.state) {
    return (
      <div className="rounded-xl border border-[color:var(--wsu-border)] bg-white px-6 py-10 text-center">
        <p className="text-sm text-red-700">{builder.error || "No active form."}</p>
        <p className="mt-2 text-sm text-[color:var(--wsu-muted)]">
          Create or select a form on the{" "}
          <Link href="/forms/manage" className="font-medium text-wsu-crimson hover:underline">
            Manage
          </Link>{" "}
          page first.
        </p>
        <button type="button" onClick={() => void builder.load()} className={`${secondaryBtn} mt-4`}>
          Retry
        </button>
      </div>
    );
  }

  const selectedField = builder.state.fields.find((f) => f.columnTitle === builder.selectedTitle) ?? null;
  const selectedColumn =
    selectedField && isFieldFormItem(selectedField)
      ? builder.state.columns.find((c) => c.title === builder.selectedTitle) ??
        builder.state.columns.find((c) => c.title.toLowerCase() === builder.selectedTitle?.toLowerCase()) ??
        null
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-medium tracking-[-0.02em] text-ink">Form builder</h1>
          <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">
            {builder.state.sheetName}
            {builder.state.demo ? " · Demo mode" : ""}
            {builder.dirty ? " · Unsaved changes" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondaryBtn} onClick={() => setPreviewOpen((v) => !v)}>
            {previewOpen ? "Hide preview" : "Show preview"}
          </button>
          <button type="button" className={secondaryBtn} onClick={() => void builder.load()} disabled={builder.saving}>
            Refresh
          </button>
          <button type="button" className={primaryBtn} onClick={() => void builder.save()} disabled={builder.saving || !builder.dirty}>
            {builder.saving ? "Saving…" : "Save layout"}
          </button>
        </div>
      </div>

      {builder.message ? (
        <p className={`rounded-lg px-3 py-2 text-xs ${builder.message.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {builder.message.text}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <FormPresentationEditor
            sheetName={builder.state.sheetName}
            formTitle={builder.state.formTitle}
            formDescription={builder.state.formDescription}
            allowedDomains={builder.state.allowedDomains}
            envAllowedDomains={builder.state.envAllowedDomains}
            attachmentsEnabled={builder.state.attachmentsEnabled}
            envAttachmentsEnabled={builder.state.envAttachmentsEnabled}
            formPublic={builder.state.formPublic}
            publicUrl={builder.state.publicUrl}
            onChange={builder.setFormPresentation}
          />
          <FieldPalette onAdd={(type) => void builder.addElement(type)} />
        </div>

        <div className="space-y-4">
          <FieldCanvas
            fields={builder.state.fields}
            columns={builder.state.columns}
            selectedTitle={builder.selectedTitle}
            lockedSet={builder.lockedSet}
            onSelect={builder.setSelectedTitle}
            onToggleHidden={(title, hidden) => builder.updateField(title, { hiddenOnForm: hidden })}
            onReorder={(from, to) => {
              builder.updateFields((fields) => {
                const next = [...fields];
                const [item] = next.splice(from, 1);
                if (!item) return fields;
                next.splice(to, 0, item);
                return next;
              });
            }}
          />
          <ConditionalRulesEditor
            rules={builder.state.conditionalLogic}
            fields={builder.state.fields}
            onChange={builder.setConditionalLogic}
          />
        </div>

        <div className="space-y-4">
          <FieldInspector
            key={selectedField?.columnTitle ?? "none"}
            field={selectedField}
            column={selectedColumn}
            locked={selectedField ? builder.lockedSet.has(selectedField.columnTitle.toLowerCase()) : false}
            onChange={(patch) => {
              if (!selectedField) return;
              builder.updateField(selectedField.columnTitle, patch);
            }}
            onRename={async (title) => {
              if (!selectedColumn || !selectedField) return;
              await builder.renameColumn(selectedColumn.id, title);
              builder.updateFields((fields) =>
                fields.map((f) =>
                  f.columnTitle === selectedField.columnTitle
                    ? { ...f, columnTitle: title }
                    : f,
                ),
              );
              builder.setSelectedTitle(title);
              await builder.load();
            }}
            onOptions={async (options) => {
              if (!selectedColumn) return;
              const type = selectedColumn.type === "MULTI_PICKLIST" ? "MULTI_PICKLIST" : "PICKLIST";
              await builder.updatePicklistOptions(selectedColumn.id, options, type);
              await builder.load();
            }}
            onDelete={() => {
              if (selectedField) void builder.deleteField(selectedField.columnTitle);
            }}
          />
        </div>
      </div>

      {previewOpen && builder.previewSchema ? (
        <section className="rounded-xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/30 p-4">
          <h2 className="mb-3 text-sm font-medium text-[color:var(--wsu-ink)]">Live preview</h2>
          <SubmissionFormView
            schema={builder.previewSchema}
            serverErrors={[]}
            preview
            onSubmit={async () => ({ ok: true })}
          />
        </section>
      ) : null}
    </div>
  );
}
