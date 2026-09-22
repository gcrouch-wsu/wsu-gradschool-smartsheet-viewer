"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconCheck, IconCopy, IconFile, IconLayers } from "@/components/forms/icons";
import { FormSheetPicker } from "@/components/forms/sheet/FormSheetPicker";
import type { ExcelEditableType, ExcelImportColumn, ExcelImportOverride } from "@/lib/forms/excel-import-types";

interface SheetOption {
  id: number;
  name: string;
}

export type CreateFormMode = "template" | "scratch" | "excel";

export interface CreateFormModalProps {
  open: boolean;
  onClose: () => void;
  mode: CreateFormMode;
  onModeChange: (mode: CreateFormMode) => void;
  templateId: string;
  onTemplateIdChange: (value: string) => void;
  sheets: SheetOption[];
  sheetsError: string;
  newName: string;
  onNewNameChange: (value: string) => void;
  destinationFolderId: string;
  onDestinationFolderIdChange: (value: string) => void;
  creating: boolean;
  onCreate: () => void;
  createMsg: { ok: boolean; text: string } | null;
  /** Excel mode */
  excelFile: File | null;
  onExcelFileChange: (file: File | null) => void;
  excelColumns: ExcelImportColumn[] | null;
  onExcelColumnsChange: (columns: ExcelImportColumn[] | null) => void;
  excelRowCount: number;
  excelPreviewing: boolean;
  excelPreviewError: string;
  onExcelPreview: (file?: File | null) => void;
}

const TYPE_OPTIONS: { value: ExcelEditableType; label: string }[] = [
  { value: "TEXT_NUMBER", label: "Text / number" },
  { value: "PICKLIST", label: "Dropdown" },
  { value: "CHECKBOX", label: "Checkbox" },
  { value: "DATE", label: "Date" },
  { value: "PHONE", label: "Phone" },
];

function typeSelectValue(col: ExcelImportColumn): ExcelEditableType {
  // NUMBER is a UI-only hint mapped to TEXT_NUMBER for Smartsheet
  return col.type;
}

export function CreateFormModal({
  open,
  onClose,
  mode,
  onModeChange,
  templateId,
  onTemplateIdChange,
  sheets,
  sheetsError,
  newName,
  onNewNameChange,
  destinationFolderId,
  onDestinationFolderIdChange,
  creating,
  onCreate,
  createMsg,
  excelFile,
  onExcelFileChange,
  excelColumns,
  onExcelColumnsChange,
  excelRowCount,
  excelPreviewing,
  excelPreviewError,
  onExcelPreview,
}: CreateFormModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const templateOptions = useMemo(
    () => sheets.map((sheet) => ({ id: String(sheet.id), name: sheet.name })),
    [sheets],
  );

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !creating) onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, creating, onClose]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  function patchColumn(sourceIndex: number, patch: Partial<ExcelImportColumn>) {
    if (!excelColumns) return;
    onExcelColumnsChange(
      excelColumns.map((c) => (c.sourceIndex === sourceIndex ? { ...c, ...patch } : c)),
    );
  }

  function acceptFile(file: File | null) {
    onExcelFileChange(file);
    onExcelColumnsChange(null);
    if (file) onExcelPreview(file);
  }

  if (!open) return null;

  const modalWidth = mode === "excel" ? "max-w-3xl" : "max-w-lg";
  const includedCount = excelColumns?.filter((c) => c.included).length ?? 0;
  const canCreateExcel = Boolean(excelFile && excelColumns && includedCount > 0 && !excelPreviewing);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(35,31,32,0.4)] p-4"
      role="presentation"
      onClick={() => {
        if (!creating) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-form-modal-title"
        className={`max-h-[min(90vh,720px)] w-full ${modalWidth} overflow-y-auto rounded-xl border border-[color:var(--wsu-border)] bg-white shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--wsu-border)] px-5 py-4">
          <div>
            <h2 id="create-form-modal-title" className="text-base font-medium text-[color:var(--wsu-ink)]">
              Create a form
            </h2>
            <p className="mt-0.5 text-xs text-[color:var(--wsu-muted)]">
              Prefer a template when approval emails should go to the address entered on the form. Scratch and Excel
              sheets need Approval Request automations added later in Smartsheet.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--wsu-border)] text-[color:var(--wsu-muted)] hover:bg-[color:var(--wsu-stone)] hover:text-[color:var(--wsu-ink)] disabled:opacity-50"
            aria-label="Close"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="inline-flex flex-wrap rounded-lg border border-[color:var(--wsu-border)] p-0.5">
            <button
              type="button"
              onClick={() => onModeChange("template")}
              className={[
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                mode === "template"
                  ? "bg-[color:var(--wsu-stone)] font-medium text-[color:var(--wsu-ink)]"
                  : "font-normal text-[color:var(--wsu-muted)] hover:text-[color:var(--wsu-ink)]",
              ].join(" ")}
            >
              <IconCopy className="h-3.5 w-3.5" />
              From a template
            </button>
            <button
              type="button"
              onClick={() => onModeChange("scratch")}
              className={[
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                mode === "scratch"
                  ? "bg-[color:var(--wsu-stone)] font-medium text-[color:var(--wsu-ink)]"
                  : "font-normal text-[color:var(--wsu-muted)] hover:text-[color:var(--wsu-ink)]",
              ].join(" ")}
            >
              <IconLayers className="h-3.5 w-3.5" />
              From scratch
            </button>
            <button
              type="button"
              onClick={() => onModeChange("excel")}
              className={[
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                mode === "excel"
                  ? "bg-[color:var(--wsu-stone)] font-medium text-[color:var(--wsu-ink)]"
                  : "font-normal text-[color:var(--wsu-muted)] hover:text-[color:var(--wsu-ink)]",
              ].join(" ")}
            >
              <IconFile className="h-3.5 w-3.5" />
              From Excel
            </button>
          </div>

          <div>
            <label htmlFor="create-form-newName" className="mb-1 block text-xs text-[color:var(--wsu-muted)]">
              New form name
            </label>
            <input
              id="create-form-newName"
              type="text"
              placeholder="Parking Permit Request"
              value={newName}
              onChange={(e) => onNewNameChange(e.target.value)}
              className="w-full rounded-lg border border-[color:var(--wsu-border)] px-3 py-2 text-sm text-[color:var(--wsu-ink)] placeholder:text-[color:var(--wsu-muted)] focus:border-wsu-crimson focus:outline-none focus:ring-1 focus:ring-wsu-crimson"
            />
          </div>

          {mode === "template" ? (
            <div>
              <FormSheetPicker
                forms={templateOptions}
                selectedSheetId={templateId}
                onSheetChange={onTemplateIdChange}
                label="Template sheet"
                labelHtmlFor="create-form-template"
                inputId="create-form-template"
                listboxId="create-form-template-listbox"
                placeholder="Search sheets by name or ID…"
                emptyMessage="No matching sheets."
                className="relative w-full"
                disabled={creating}
              />
              <p className="mt-2 text-xs text-[color:var(--wsu-muted)]">
                Best for approval notifications: clone a sheet whose Smartsheet automations request approval from
                contacts in the form’s Contact column. Rules copy when the API allows; you can still edit them in
                Smartsheet afterward.
              </p>
              {sheetsError ? (
                <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{sheetsError}</p>
              ) : null}
            </div>
          ) : null}

          {mode === "scratch" ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              From scratch creates columns only — no Approval Request automations. After create, open the sheet in
              Smartsheet → Automation and request approval from contacts in the form’s Contact/email column, or{" "}
              <button
                type="button"
                onClick={() => onModeChange("template")}
                className="font-medium text-wsu-crimson underline underline-offset-2 hover:text-wsu-crimson-dark"
              >
                use a template instead
              </button>
              .
            </p>
          ) : null}

          {mode === "excel" ? (
            <div className="space-y-3">
              <div
                className={[
                  "rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
                  dragOver
                    ? "border-wsu-crimson bg-red-50/40"
                    : "border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/40",
                ].join(" ")}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0] ?? null;
                  if (f) acceptFile(f);
                }}
              >
                <IconFile className="mx-auto h-8 w-8 text-[color:var(--wsu-muted)]" />
                <p className="mt-2 text-sm text-[color:var(--wsu-ink)]">
                  {excelFile ? excelFile.name : "Drop an .xlsx or .csv file here"}
                </p>
                <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">
                  Row 1 = column names. Formula columns are detected automatically.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    acceptFile(f);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={creating || excelPreviewing}
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-1.5 text-sm font-medium text-[color:var(--wsu-ink)] hover:bg-white disabled:opacity-50"
                >
                  {excelFile ? "Choose a different file" : "Choose file"}
                </button>
              </div>

              {excelPreviewing ? (
                <p className="text-xs text-[color:var(--wsu-muted)]">Reading spreadsheet…</p>
              ) : null}
              {excelPreviewError ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{excelPreviewError}</p>
              ) : null}

              {excelColumns && excelColumns.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-xs font-medium text-[color:var(--wsu-ink)]">
                      Columns ({includedCount} of {excelColumns.length} included)
                    </p>
                    <p className="text-xs text-[color:var(--wsu-muted)]">
                      {excelRowCount} data row{excelRowCount === 1 ? "" : "s"} will be imported
                    </p>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-[color:var(--wsu-border)]">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-[color:var(--wsu-stone)] text-[color:var(--wsu-muted)]">
                        <tr>
                          <th className="px-2 py-2 font-medium">Include</th>
                          <th className="px-2 py-2 font-medium">Name</th>
                          <th className="px-2 py-2 font-medium">Type</th>
                          <th className="px-2 py-2 font-medium">Formula</th>
                        </tr>
                      </thead>
                      <tbody>
                        {excelColumns.map((col) => (
                          <tr key={col.sourceIndex} className="border-t border-[color:var(--wsu-border)]">
                            <td className="px-2 py-2 align-top">
                              <input
                                type="checkbox"
                                checked={col.included}
                                disabled={creating}
                                onChange={(e) => patchColumn(col.sourceIndex, { included: e.target.checked })}
                                aria-label={`Include ${col.title}`}
                              />
                            </td>
                            <td className="px-2 py-2 align-top">
                              <input
                                type="text"
                                value={col.title}
                                disabled={creating || !col.included}
                                onChange={(e) => patchColumn(col.sourceIndex, { title: e.target.value })}
                                className="w-full min-w-[8rem] rounded border border-[color:var(--wsu-border)] px-2 py-1 text-[color:var(--wsu-ink)] disabled:opacity-50"
                              />
                              {col.sampleValues.length ? (
                                <p className="mt-0.5 truncate text-[10px] text-[color:var(--wsu-muted)]" title={col.sampleValues.join(", ")}>
                                  e.g. {col.sampleValues.join(", ")}
                                </p>
                              ) : null}
                            </td>
                            <td className="px-2 py-2 align-top">
                              <select
                                value={typeSelectValue(col)}
                                disabled={creating || !col.included}
                                onChange={(e) => {
                                  const type = e.target.value as ExcelEditableType;
                                  patchColumn(col.sourceIndex, {
                                    type: type === "NUMBER" ? "TEXT_NUMBER" : type,
                                    options: type === "PICKLIST" ? col.options ?? ["Option 1", "Option 2"] : undefined,
                                  });
                                }}
                                className="rounded border border-[color:var(--wsu-border)] px-2 py-1 text-[color:var(--wsu-ink)] disabled:opacity-50"
                              >
                                {TYPE_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-2 align-top">
                              {col.hasExcelFormula ? (
                                <div className="space-y-1">
                                  <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-900">
                                    Formula
                                  </span>
                                  {col.smartsheetFormula ? (
                                    <label className="flex items-start gap-1.5 text-[10px] text-[color:var(--wsu-ink)]">
                                      <input
                                        type="checkbox"
                                        className="mt-0.5"
                                        checked={col.applyFormula !== false}
                                        disabled={creating || !col.included}
                                        onChange={(e) =>
                                          patchColumn(col.sourceIndex, {
                                            applyFormula: e.target.checked,
                                            formulaNote: e.target.checked
                                              ? `Will set Smartsheet formula: ${col.smartsheetFormula}`
                                              : "Excel formula noted; importing values as static data (formula not applied).",
                                          })
                                        }
                                      />
                                      <span className="break-all">
                                        {col.applyFormula === false
                                          ? "Import values as static data (skip Smartsheet formula)."
                                          : col.formulaNote || col.smartsheetFormula}
                                      </span>
                                    </label>
                                  ) : (
                                    <p className="text-[10px] text-[color:var(--wsu-muted)]">
                                      {col.formulaNote || "Values imported as static data."}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[color:var(--wsu-muted)]">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                    Excel import creates columns and data only — no Approval Request automations. Use a template if you
                    need post-submission workflows.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          <div>
            <label htmlFor="create-form-folderId" className="mb-1 block text-xs text-[color:var(--wsu-muted)]">
              Destination folder ID <span className="text-[color:var(--wsu-muted)]/70">· optional</span>
            </label>
            <input
              id="create-form-folderId"
              type="text"
              placeholder="Smartsheet folder ID"
              value={destinationFolderId}
              onChange={(e) => onDestinationFolderIdChange(e.target.value)}
              className="w-full rounded-lg border border-[color:var(--wsu-border)] px-3 py-2 text-sm text-[color:var(--wsu-ink)] placeholder:text-[color:var(--wsu-muted)] focus:border-wsu-crimson focus:outline-none focus:ring-1 focus:ring-wsu-crimson"
            />
          </div>

          {createMsg ? (
            <p
              className={`rounded-lg px-3 py-2 text-xs ${createMsg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}
            >
              {createMsg.text}
              {createMsg.ok
                ? " Next: edit fields and allowed domains in Builder, then publish from Manage to share /f/…"
                : ""}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-[color:var(--wsu-border)] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="rounded-lg border border-[color:var(--wsu-border)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--wsu-ink)] hover:bg-[color:var(--wsu-stone)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onCreate}
            disabled={creating || (mode === "excel" && !canCreateExcel)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-wsu-crimson px-4 py-2 text-sm font-medium text-white hover:bg-wsu-crimson-dark disabled:opacity-60"
          >
            <IconCheck className="h-4 w-4" />
            {creating ? "Creating…" : "Create form"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Build override payload from the reviewed column table for the create API. */
export function excelOverridesFromColumns(columns: ExcelImportColumn[]): ExcelImportOverride[] {
  return columns.map((c) => ({
    sourceIndex: c.sourceIndex,
    title: c.title,
    type: c.type,
    options: c.options,
    included: c.included,
    applyFormula: c.smartsheetFormula ? c.applyFormula !== false : false,
  }));
}
