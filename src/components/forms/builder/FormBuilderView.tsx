"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { HeaderCustomTextEditor } from "@/components/ui/HeaderCustomTextEditor";
import { SubmissionFormView } from "@/components/forms/submission/SubmissionFormView";
import { IconPlus } from "@/components/forms/icons";
import type { FormFieldDefinition } from "@/lib/forms/form-field-config";
import { isFieldFormItem, isLayoutFormItem } from "@/lib/forms/form-field-config";
import { listMappableCheckboxColumns } from "@/lib/forms/form-field-meta";
import type { ConditionalRule, SmartsheetColumn } from "@/lib/forms/types";
import {
  type BuilderElementType,
  type BuilderFieldType,
  useFormBuilder,
} from "@/components/forms/builder/useFormBuilder";
import { PdfMappingEditor } from "@/components/forms/builder/PdfMappingEditor";
import { richTextPlainText } from "@/lib/rendering";

const inputClass =
  "w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm text-[color:var(--wsu-ink)] focus:border-wsu-crimson focus:outline-none focus:ring-1 focus:ring-wsu-crimson";

const secondaryBtn =
  "rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm font-medium text-[color:var(--wsu-ink)] hover:bg-[color:var(--wsu-stone)] disabled:opacity-50";

const primaryBtn =
  "rounded-lg bg-wsu-crimson px-4 py-2 text-sm font-medium text-white hover:bg-wsu-crimson-dark disabled:opacity-60";

type BuilderMode = "edit" | "preview" | "pdf";
type RailTab = "add" | "field";

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
  headerLogoDataUrl,
  headerLogoAlt,
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
  headerLogoDataUrl: string;
  headerLogoAlt: string;
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
    headerLogoDataUrl?: string;
    headerLogoAlt?: string;
  }) => void;
}) {
  const domainsText = allowedDomains.join(", ");
  const envDefault = (envAllowedDomains.length ? envAllowedDomains : ["wsu.edu"]).join(", ");
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState("");

  async function onPickLogo(file: File | null) {
    if (!file) return;
    setLogoBusy(true);
    setLogoError("");
    try {
      const { readLogoFileAsDataUrl, HEADER_LOGO_ALT_MAX_LENGTH } = await import("@/lib/header-logo");
      const result = await readLogoFileAsDataUrl(file);
      if (!result.ok) {
        setLogoError(result.error);
        return;
      }
      const alt = (headerLogoAlt.trim() || "Washington State University").slice(0, HEADER_LOGO_ALT_MAX_LENGTH);
      onChange({ headerLogoDataUrl: result.dataUrl, headerLogoAlt: alt });
    } finally {
      setLogoBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-[color:var(--wsu-border)] px-4 py-3">
      <p className="text-xs text-[color:var(--wsu-muted)]">
        Shown at the top of the public form. Set domains, then publish from Manage.
      </p>
      <div>
        <label className="mb-1 block text-xs text-[color:var(--wsu-muted)]">Header logo</label>
        <p className="mb-2 text-[11px] text-[color:var(--wsu-muted)]">
          All forms use the WSU lockup by default. Optionally upload a PNG/JPEG (max 256KB) or paste another image URL.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-14 max-w-[10rem] items-center justify-center overflow-hidden rounded-lg border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/40 px-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of default or custom logo */}
            <img
              src={
                headerLogoDataUrl.trim() && headerLogoAlt.trim()
                  ? headerLogoDataUrl
                  : "https://s3.wp.wsu.edu/uploads/sites/1999/2021/09/WSU-lockup-horz-rgb-6in.jpg"
              }
              alt=""
              className="h-full w-full object-contain py-1"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <label className={`${secondaryBtn} cursor-pointer ${logoBusy ? "pointer-events-none opacity-50" : ""}`}>
              {logoBusy ? "Uploading…" : headerLogoDataUrl.trim() ? "Replace file" : "Upload file"}
              <input
                type="file"
                accept="image/png,image/jpeg"
                className="sr-only"
                disabled={logoBusy}
                onChange={(e) => {
                  void onPickLogo(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </label>
            {headerLogoDataUrl.trim() ? (
              <button
                type="button"
                className={secondaryBtn}
                onClick={() => onChange({ headerLogoDataUrl: "", headerLogoAlt: "" })}
              >
                Use WSU default
              </button>
            ) : null}
          </div>
        </div>
        <label className="mt-2 block">
          <span className="mb-1 block text-[11px] text-[color:var(--wsu-muted)]">Or image URL (leave blank for WSU default)</span>
          <input
            className={inputClass}
            type="url"
            value={/^data:/i.test(headerLogoDataUrl) ? "" : headerLogoDataUrl}
            placeholder="https://s3.wp.wsu.edu/…/WSU-lockup-horz-rgb-6in.jpg"
            onChange={(e) => {
              const url = e.target.value.trim();
              setLogoError("");
              if (!url) {
                if (!/^data:/i.test(headerLogoDataUrl)) {
                  onChange({ headerLogoDataUrl: "", headerLogoAlt: "" });
                }
                return;
              }
              const alt = headerLogoAlt.trim() || "Washington State University";
              onChange({ headerLogoDataUrl: url, headerLogoAlt: alt });
            }}
          />
        </label>
        {headerLogoDataUrl.trim() ? (
          <label className="mt-2 block">
            <span className="mb-1 block text-[11px] text-[color:var(--wsu-muted)]">Logo alt text (required)</span>
            <input
              className={inputClass}
              value={headerLogoAlt}
              maxLength={200}
              onChange={(e) => onChange({ headerLogoAlt: e.target.value })}
              placeholder="Washington State University logo"
            />
          </label>
        ) : null}
        {logoError ? <p className="mt-1 text-xs text-red-600">{logoError}</p> : null}
      </div>
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
          <p>Draft — publish from Manage to get a public /f/… URL for submissions.</p>
        )}
      </div>
    </div>
  );
}

function FieldPalette({ onAdd }: { onAdd: (type: BuilderElementType) => void }) {
  const chipClass =
    "flex flex-col items-start gap-0.5 rounded-lg border border-[color:var(--wsu-border)] px-2.5 py-2 text-left hover:border-wsu-crimson/40 hover:bg-[color:var(--wsu-stone)]/50";

  return (
    <div className="space-y-4 p-3">
      <div>
        <h3 className="text-xs font-medium uppercase tracking-wide text-[color:var(--wsu-muted)]">Layout</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {ELEMENT_PALETTE.map((item) => (
            <button
              key={item.type}
              type="button"
              title={item.hint}
              onClick={() => onAdd(item.type)}
              className={chipClass}
            >
              <span className="flex items-center gap-1 text-sm font-medium text-[color:var(--wsu-ink)]">
                <IconPlus className="h-3.5 w-3.5 shrink-0 text-wsu-crimson" />
                {item.label}
              </span>
              <span className="line-clamp-1 text-[11px] text-[color:var(--wsu-muted)]">{item.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-medium uppercase tracking-wide text-[color:var(--wsu-muted)]">Fields</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {FIELD_PALETTE.map((item) => (
            <button
              key={item.type}
              type="button"
              title={item.hint}
              onClick={() => onAdd(item.type)}
              className={chipClass}
            >
              <span className="flex items-center gap-1 text-sm font-medium text-[color:var(--wsu-ink)]">
                <IconPlus className="h-3.5 w-3.5 shrink-0 text-wsu-crimson" />
                {item.label}
              </span>
              <span className="line-clamp-1 text-[11px] text-[color:var(--wsu-muted)]">{item.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
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
  onReorder: (fromTitle: string, toTitle: string) => void;
}) {
  const [dragTitle, setDragTitle] = useState<string | null>(null);
  const byTitle = useMemo(() => new Map(columns.map((c) => [c.title.toLowerCase(), c])), [columns]);

  const formFields = fields.filter((f) => !lockedSet.has(f.columnTitle.toLowerCase()) || !f.hiddenOnForm || isLayoutFormItem(f));
  const lockedHidden = fields.filter((f) => isFieldFormItem(f) && lockedSet.has(f.columnTitle.toLowerCase()) && f.hiddenOnForm);

  return (
    <section className="rounded-xl border border-[color:var(--wsu-border)] bg-white p-4">
      <h2 className="text-sm font-medium text-[color:var(--wsu-ink)]">Form layout</h2>
      <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">Drag to reorder. Toggle to include on the public form.</p>
      <ul className="mt-3 space-y-2">
        {formFields.map((field) => {
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
              onDragStart={() => setDragTitle(field.columnTitle)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!dragTitle || dragTitle === field.columnTitle) return;
                onReorder(dragTitle, field.columnTitle);
                setDragTitle(null);
              }}
              onDragEnd={() => setDragTitle(null)}
              className={[
                "flex items-center gap-3 rounded-lg border px-3 py-2",
                selected ? "border-wsu-crimson bg-wsu-crimson/5" : "border-[color:var(--wsu-border)] bg-white",
                field.hiddenOnForm ? "opacity-60" : "",
                dragTitle === field.columnTitle ? "opacity-40" : "",
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
  onColumnType,
  onDelete,
  bare = false,
  allColumns = [],
}: {
  field: FormFieldDefinition | null;
  column: SmartsheetColumn | null;
  locked: boolean;
  onChange: (patch: Partial<FormFieldDefinition>) => void;
  onRename: (title: string) => Promise<void>;
  onOptions: (options: string[], columnType?: "PICKLIST" | "MULTI_PICKLIST") => Promise<void>;
  onColumnType: (type: string, options?: string[]) => Promise<void>;
  onDelete: () => void;
  /** When true, omit outer card chrome (used inside the right rail). */
  bare?: boolean;
  allColumns?: SmartsheetColumn[];
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

  const shell = (children: ReactNode) =>
    bare ? (
      <div className="space-y-4 p-3">{children}</div>
    ) : (
      <section className="space-y-4 rounded-xl border border-[color:var(--wsu-border)] bg-white p-4">{children}</section>
    );

  if (!field) {
    return shell(
      <>
        <h2 className="text-sm font-medium text-[color:var(--wsu-ink)]">Element properties</h2>
        <p className="text-sm text-[color:var(--wsu-muted)]">Select a field or layout element on the canvas.</p>
      </>,
    );
  }

  if (isLayoutFormItem(field)) {
    return shell(
      <>
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
      </>,
    );
  }

  if (!column) {
    return shell(
      <>
        <h2 className="text-sm font-medium text-[color:var(--wsu-ink)]">Field properties</h2>
        <p className="text-sm text-[color:var(--wsu-muted)]">Column not found on the sheet.</p>
      </>,
    );
  }

  return shell(
    <>
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

      {column.type === "TEXT_NUMBER" ||
      column.type === "CONTACT_LIST" ||
      column.type === "PHONE" ||
      column.type === "PICKLIST" ||
      column.type === "MULTI_PICKLIST" ? (
        <div>
          <label className="mb-1 block text-xs text-[color:var(--wsu-muted)]">Input kind</label>
          <select
            className={inputClass}
            value={
              column.type === "MULTI_PICKLIST" || field.kindHint === "multiselect"
                ? "MULTI_PICKLIST"
                : column.type === "PICKLIST"
                  ? field.kindHint === "select" || field.kindHint === "dropdown"
                    ? "DROPDOWN"
                    : "RADIO"
                  : field.kindHint ??
                    (column.type === "PHONE" ? "phone" : column.type === "CONTACT_LIST" ? "email" : "text")
            }
            disabled={locked || busy}
            onChange={async (e) => {
              const next = e.target.value;
              if (next === "RADIO" || next === "DROPDOWN" || next === "MULTI_PICKLIST") {
                const asMulti = next === "MULTI_PICKLIST";
                const asDropdown = next === "DROPDOWN";
                const targetType = asMulti ? "MULTI_PICKLIST" : "PICKLIST";
                setBusy(true);
                setLocalError("");
                try {
                  const options = optionsDraft
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  const resolved =
                    options.length > 0
                      ? options
                      : column.options?.length
                        ? column.options
                        : field.checkboxLabels?.filter(Boolean)?.length
                          ? (field.checkboxLabels as string[])
                          : ["Yes", "No"];
                  if (column.type !== targetType) {
                    await onColumnType(targetType, resolved);
                  }
                  setOptionsDraft(resolved.join("\n"));
                  if (asMulti) {
                    const mappable = listMappableCheckboxColumns(allColumns);
                    const checkboxColumns = mappable.slice(0, resolved.length).map((c) => c.title);
                    onChange({
                      kindHint: "multiselect",
                      checkboxLabels: resolved,
                      checkboxColumns,
                    });
                    if (!checkboxColumns.length) {
                      setLocalError(
                        "No CHKBOX_* columns found on the sheet. Add Smartsheet checkbox columns, then map them below.",
                      );
                    }
                  } else {
                    onChange({
                      kindHint: asDropdown ? "dropdown" : "radio",
                      checkboxColumns: undefined,
                      checkboxLabels: undefined,
                    });
                  }
                } catch (err: unknown) {
                  setLocalError(err instanceof Error ? err.message : "Could not update field type.");
                } finally {
                  setBusy(false);
                }
                return;
              }

              if (column.type === "PICKLIST" || column.type === "MULTI_PICKLIST") {
                setBusy(true);
                setLocalError("");
                try {
                  await onColumnType("TEXT_NUMBER");
                  onChange({
                    kindHint: next as FormFieldDefinition["kindHint"],
                    checkboxColumns: undefined,
                    checkboxLabels: undefined,
                  });
                } catch (err: unknown) {
                  setLocalError(err instanceof Error ? err.message : "Could not update field type.");
                } finally {
                  setBusy(false);
                }
                return;
              }

              onChange({ kindHint: next as FormFieldDefinition["kindHint"] });
            }}
          >
            {column.type === "TEXT_NUMBER" || column.type === "CONTACT_LIST" || column.type === "PHONE" ? (
              <>
                <option value="text">Short text</option>
                <option value="textarea">Long text</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="number">Number</option>
              </>
            ) : (
              <option value="text">Short text</option>
            )}
            <option value="RADIO">Radio buttons (one choice)</option>
            <option value="DROPDOWN">Dropdown (one choice)</option>
            <option value="MULTI_PICKLIST">Checkboxes (multiple)</option>
          </select>
          {column.type === "MULTI_PICKLIST" || field.kindHint === "multiselect" ? (
            <p className="mt-1 text-[11px] text-[color:var(--wsu-muted)]">
              Each checkbox writes to its own CHKBOX_* column. Matches Smartsheet Forms vertical checkboxes.
            </p>
          ) : column.type === "PICKLIST" ? (
            <p className="mt-1 text-[11px] text-[color:var(--wsu-muted)]">
              Smartsheet Dropdown (single-select) defaults to radio buttons (like the leave form screenshot). Use
              Dropdown only for a compact select list.
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-[color:var(--wsu-muted)]">
              Choose Radio, Dropdown, or Checkboxes to convert this column.
            </p>
          )}
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

      {column.type === "PICKLIST" || column.type === "MULTI_PICKLIST" || column.type === "TEXT_NUMBER" ? (
        <div>
          <label className="mb-1 block text-xs text-[color:var(--wsu-muted)]">
            {column.type === "TEXT_NUMBER" ? "Options (used when converting to dropdown/checkboxes)" : "Options (one per line)"}
          </label>
          <textarea
            className={`${inputClass} min-h-[6rem]`}
            value={optionsDraft}
            disabled={locked || busy}
            onChange={(e) => setOptionsDraft(e.target.value)}
            placeholder={"Option 1\nOption 2\nOption 3"}
          />
          {column.type === "PICKLIST" || column.type === "MULTI_PICKLIST" ? (
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
                  const type = column.type === "MULTI_PICKLIST" ? "MULTI_PICKLIST" : "PICKLIST";
                  await onOptions(options, type);
                  if (type === "MULTI_PICKLIST") {
                    const existing = field.checkboxColumns ?? [];
                    const mappable = listMappableCheckboxColumns(allColumns);
                    const checkboxColumns =
                      existing.length >= options.length
                        ? existing.slice(0, options.length)
                        : [
                            ...existing,
                            ...mappable
                              .map((c) => c.title)
                              .filter((t) => !existing.some((e) => e.toLowerCase() === t.toLowerCase()))
                              .slice(0, Math.max(0, options.length - existing.length)),
                          ].slice(0, options.length);
                    onChange({ checkboxLabels: options, checkboxColumns, kindHint: "multiselect" });
                  }
                } catch (e: unknown) {
                  setLocalError(e instanceof Error ? e.message : "Could not update options.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save options
            </button>
          ) : null}
        </div>
      ) : null}

      {(column.type === "MULTI_PICKLIST" || field.kindHint === "multiselect") && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="block text-xs text-[color:var(--wsu-muted)]">Checkbox → Smartsheet column</label>
            <button
              type="button"
              className="text-xs font-medium text-wsu-crimson hover:underline"
              disabled={locked}
              onClick={() => {
                const labels = optionsDraft
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean);
                const resolved =
                  labels.length > 0
                    ? labels
                    : column.options?.length
                      ? column.options
                      : field.checkboxLabels ?? [];
                const mappable = listMappableCheckboxColumns(allColumns);
                onChange({
                  kindHint: "multiselect",
                  checkboxLabels: resolved,
                  checkboxColumns: mappable.slice(0, resolved.length).map((c) => c.title),
                });
              }}
            >
              Auto-map CHKBOX_*
            </button>
          </div>
          <p className="text-[11px] text-[color:var(--wsu-muted)]">
            Each option below writes true/false to the selected checkbox column on submit.
          </p>
          {(field.checkboxLabels?.length
            ? field.checkboxLabels
            : optionsDraft.split("\n").map((s) => s.trim()).filter(Boolean)
          ).map((label, index) => {
            const mappable = listMappableCheckboxColumns(allColumns);
            const current = field.checkboxColumns?.[index] ?? "";
            return (
              <div key={`${label}-${index}`} className="grid gap-1 sm:grid-cols-[1fr_1fr]">
                <p className="truncate rounded-lg border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/40 px-2 py-2 text-xs text-[color:var(--wsu-ink)]">
                  {label || `Option ${index + 1}`}
                </p>
                <select
                  className={inputClass}
                  value={current}
                  disabled={locked}
                  onChange={(e) => {
                    const next = [...(field.checkboxColumns ?? [])];
                    while (next.length <= index) next.push("");
                    next[index] = e.target.value;
                    const labels =
                      field.checkboxLabels?.length
                        ? field.checkboxLabels
                        : optionsDraft.split("\n").map((s) => s.trim()).filter(Boolean);
                    onChange({
                      kindHint: "multiselect",
                      checkboxColumns: next,
                      checkboxLabels: labels,
                    });
                  }}
                >
                  <option value="">Select column…</option>
                  {mappable.map((c) => (
                    <option key={c.id} value={c.title}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}


      {localError ? <p className="text-xs text-red-700">{localError}</p> : null}

      {!locked ? (
        <button type="button" onClick={onDelete} className="text-sm font-medium text-red-700 hover:underline">
          Delete field
        </button>
      ) : (
        <p className="text-xs text-[color:var(--wsu-muted)]">Workflow / system columns stay on the sheet but off the public form.</p>
      )}
    </>,
  );
}

function ConditionalRulesEditor({
  rules,
  fields,
  onChange,
  open,
  onToggle,
}: {
  rules: ConditionalRule[];
  fields: FormFieldDefinition[];
  onChange: (rules: ConditionalRule[]) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const titles = fields.filter((f) => isFieldFormItem(f) && !f.hiddenOnForm).map((f) => f.columnTitle);

  function updateRule(index: number, patch: Partial<ConditionalRule>) {
    onChange(rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  }

  return (
    <section className="rounded-xl border border-[color:var(--wsu-border)] bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <div>
          <h2 className="text-sm font-medium text-[color:var(--wsu-ink)]">Conditional logic</h2>
          <p className="mt-0.5 text-xs text-[color:var(--wsu-muted)]">
            {rules.length === 0
              ? "Show fields when another field matches a value."
              : `${rules.length} rule${rules.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <span className="text-xs font-medium text-wsu-crimson">{open ? "Hide" : "Show"}</span>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-[color:var(--wsu-border)] px-4 py-3">
          <div className="flex justify-end">
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
      ) : null}
    </section>
  );
}

function RailTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-white text-[color:var(--wsu-ink)] shadow-sm"
          : "text-[color:var(--wsu-muted)] hover:text-[color:var(--wsu-ink)]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function BuilderRightRail({
  railTab,
  onRailTabChange,
  onAdd,
  inspector,
  className = "",
}: {
  railTab: RailTab;
  onRailTabChange: (tab: RailTab) => void;
  onAdd: (type: BuilderElementType) => void;
  inspector: ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={[
        "flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[color:var(--wsu-border)] bg-white",
        className,
      ].join(" ")}
    >
      <div className="shrink-0 border-b border-[color:var(--wsu-border)] p-2">
        <div className="flex rounded-lg bg-[color:var(--wsu-stone)]/60 p-0.5">
          <RailTabButton active={railTab === "add"} onClick={() => onRailTabChange("add")}>
            Add
          </RailTabButton>
          <RailTabButton active={railTab === "field"} onClick={() => onRailTabChange("field")}>
            Field
          </RailTabButton>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {railTab === "add" ? <FieldPalette onAdd={onAdd} /> : inspector}
      </div>
    </aside>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: BuilderMode;
  onChange: (mode: BuilderMode) => void;
}) {
  const labels: Record<BuilderMode, string> = { edit: "Edit", preview: "Preview", pdf: "PDF" };
  return (
    <div className="inline-flex rounded-lg border border-[color:var(--wsu-border)] bg-white p-0.5" role="group" aria-label="Builder mode">
      {(["edit", "preview", "pdf"] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={[
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            mode === value
              ? "bg-wsu-crimson text-white"
              : "text-[color:var(--wsu-ink)] hover:bg-[color:var(--wsu-stone)]",
          ].join(" ")}
        >
          {labels[value]}
        </button>
      ))}
    </div>
  );
}

export function FormBuilderView() {
  const builder = useFormBuilder();
  const [mode, setMode] = useState<BuilderMode>("edit");
  const [railTab, setRailTab] = useState<RailTab>("add");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [mobileRailOpen, setMobileRailOpen] = useState(false);

  useEffect(() => {
    if (builder.selectedTitle) {
      setRailTab("field");
    }
  }, [builder.selectedTitle]);

  useEffect(() => {
    if (builder.state?.conditionalLogic.length) {
      setRulesOpen(true);
    }
  }, [builder.state?.conditionalLogic.length]);

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

  function handleSelectField(title: string) {
    builder.setSelectedTitle(title);
    setRailTab("field");
    setMobileRailOpen(true);
  }

  function handleAdd(type: BuilderElementType) {
    void builder.addElement(type);
    setRailTab("field");
  }

  const inspector = (
    <FieldInspector
      key={selectedField?.columnTitle ?? "none"}
      bare
      field={selectedField}
      column={selectedColumn}
      allColumns={builder.state.columns}
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
            f.columnTitle === selectedField.columnTitle ? { ...f, columnTitle: title } : f,
          ),
        );
        builder.setSelectedTitle(title);
        await builder.load();
      }}
      onOptions={async (options, columnType) => {
        if (!selectedColumn) return;
        const type =
          columnType ??
          (selectedColumn.type === "MULTI_PICKLIST" ? "MULTI_PICKLIST" : "PICKLIST");
        await builder.updatePicklistOptions(selectedColumn.id, options, type);
        await builder.load();
      }}
      onColumnType={async (type, options) => {
        if (!selectedColumn) return;
        await builder.updateColumnType(selectedColumn.id, type, options);
        await builder.load();
      }}
      onDelete={() => {
        if (selectedField) void builder.deleteField(selectedField.columnTitle);
      }}
    />
  );

  return (
    <div className="flex min-h-0 flex-col gap-3 lg:h-[calc(100dvh-14rem)]">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-medium tracking-[-0.02em] text-ink">Form builder</h1>
          <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">
            {builder.state.sheetName}
            {builder.state.demo ? " · Demo mode" : ""}
            {builder.dirty ? " · Unsaved changes" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ModeToggle mode={mode} onChange={setMode} />
          {builder.state.formPublic && builder.state.publicUrl ? (
            <Link href={builder.state.publicUrl} target="_blank" rel="noreferrer" className={secondaryBtn}>
              Open public form
            </Link>
          ) : null}
          <button type="button" className={secondaryBtn} onClick={() => void builder.load()} disabled={builder.saving}>
            Refresh
          </button>
          {mode !== "pdf" ? (
            <button type="button" className={primaryBtn} onClick={() => void builder.save()} disabled={builder.saving || !builder.dirty}>
              {builder.saving ? "Saving…" : "Save layout"}
            </button>
          ) : null}
        </div>
      </div>

      {builder.message ? (
        <p className={`shrink-0 rounded-lg px-3 py-2 text-xs ${builder.message.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {builder.message.text}
        </p>
      ) : null}

      {mode === "preview" ? (
        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/40 p-3 sm:p-5">
          {builder.previewSchema ? (
            <SubmissionFormView
              schema={builder.previewSchema}
              serverErrors={[]}
              preview
              onSubmit={async () => ({ ok: true })}
            />
          ) : (
            <p className="text-sm text-[color:var(--wsu-muted)]">Preview unavailable until the layout loads.</p>
          )}
        </div>
      ) : mode === "pdf" ? (
        <div className="min-h-0 flex-1">
          <PdfMappingEditor
            sheetId={builder.state.sheetId}
            fieldOptions={builder.state.fields
              .filter((f) => !f.hiddenOnForm && isFieldFormItem(f))
              .map((f) => ({ columnTitle: f.columnTitle, label: f.label }))}
            layoutSeed={builder.state.fields
              .filter((f) => !f.hiddenOnForm)
              .map((f) => ({
                columnTitle: f.columnTitle,
                label: f.label,
                itemKind: f.itemKind,
                text: f.text,
              }))}
            formTitle={builder.state.formTitle || builder.state.sheetName}
            formDescription={builder.state.formDescription}
          />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
            <section className="shrink-0 rounded-xl border border-[color:var(--wsu-border)] bg-white">
              <button
                type="button"
                onClick={() => setSettingsOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                aria-expanded={settingsOpen}
              >
                <div>
                  <h2 className="text-sm font-medium text-[color:var(--wsu-ink)]">Form settings</h2>
                  <p className="mt-0.5 text-xs text-[color:var(--wsu-muted)]">Logo, title, description, domains, and attachments</p>
                </div>
                <span className="text-xs font-medium text-wsu-crimson">{settingsOpen ? "Hide" : "Show"}</span>
              </button>
              {settingsOpen ? (
                <FormPresentationEditor
                  sheetName={builder.state.sheetName}
                  formTitle={builder.state.formTitle}
                  formDescription={builder.state.formDescription}
                  headerLogoDataUrl={builder.state.headerLogoDataUrl}
                  headerLogoAlt={builder.state.headerLogoAlt}
                  allowedDomains={builder.state.allowedDomains}
                  envAllowedDomains={builder.state.envAllowedDomains}
                  attachmentsEnabled={builder.state.attachmentsEnabled}
                  envAttachmentsEnabled={builder.state.envAttachmentsEnabled}
                  formPublic={builder.state.formPublic}
                  publicUrl={builder.state.publicUrl}
                  onChange={builder.setFormPresentation}
                />
              ) : null}
            </section>

            <div className="flex shrink-0 flex-wrap gap-2 lg:hidden">
              <button
                type="button"
                className={secondaryBtn}
                onClick={() => {
                  setRailTab("add");
                  setMobileRailOpen(true);
                }}
              >
                Add field
              </button>
              <button
                type="button"
                className={secondaryBtn}
                onClick={() => {
                  setRailTab("field");
                  setMobileRailOpen(true);
                }}
              >
                Field settings
              </button>
            </div>

            <FieldCanvas
              fields={builder.state.fields}
              columns={builder.state.columns}
              selectedTitle={builder.selectedTitle}
              lockedSet={builder.lockedSet}
              onSelect={handleSelectField}
              onToggleHidden={(title, hidden) => builder.updateField(title, { hiddenOnForm: hidden })}
              onReorder={(fromTitle, toTitle) => {
                builder.updateFields((fields) => {
                  const from = fields.findIndex((f) => f.columnTitle === fromTitle);
                  const to = fields.findIndex((f) => f.columnTitle === toTitle);
                  if (from < 0 || to < 0 || from === to) return fields;
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
              open={rulesOpen}
              onToggle={() => setRulesOpen((v) => !v)}
            />
          </div>

          <BuilderRightRail
            className="hidden lg:flex"
            railTab={railTab}
            onRailTabChange={setRailTab}
            onAdd={handleAdd}
            inspector={inspector}
          />
        </div>
      )}

      {mobileRailOpen && mode === "edit" ? (
        <div className="fixed inset-0 z-[10000] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[color:var(--wsu-ink)]/40"
            aria-label="Close panel"
            onClick={() => setMobileRailOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-white shadow-[0_20px_50px_rgba(35,31,32,0.2)]">
            <div className="flex items-center justify-between border-b border-[color:var(--wsu-border)] px-3 py-2">
              <p className="text-sm font-medium text-[color:var(--wsu-ink)]">
                {railTab === "add" ? "Add elements" : "Field settings"}
              </p>
              <button type="button" className={secondaryBtn} onClick={() => setMobileRailOpen(false)}>
                Done
              </button>
            </div>
            <BuilderRightRail
              className="min-h-0 flex-1 rounded-none border-0"
              railTab={railTab}
              onRailTabChange={setRailTab}
              onAdd={(type) => {
                handleAdd(type);
              }}
              inspector={inspector}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
