"use client";

import { useEffect, useRef } from "react";
import { IconCheck, IconCopy, IconLayers } from "@/components/forms/icons";

interface SheetOption {
  id: number;
  name: string;
}

export interface CreateFormModalProps {
  open: boolean;
  onClose: () => void;
  mode: "template" | "scratch";
  onModeChange: (mode: "template" | "scratch") => void;
  templateId: string;
  onTemplateIdChange: (value: string) => void;
  sheets: SheetOption[];
  sheetsError: string;
  newName: string;
  onNewNameChange: (value: string) => void;
  destinationFolderId: string;
  onDestinationFolderIdChange: (value: string) => void;
  shareEmail: string;
  onShareEmailChange: (value: string) => void;
  creating: boolean;
  onCreate: () => void;
  createMsg: { ok: boolean; text: string } | null;
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
  shareEmail,
  onShareEmailChange,
  creating,
  onCreate,
  createMsg,
}: CreateFormModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

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

  if (!open) return null;

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
        className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-xl border border-[color:var(--wsu-border)] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--wsu-border)] px-5 py-4">
          <div>
            <h2 id="create-form-modal-title" className="text-base font-medium text-[color:var(--wsu-ink)]">
              Create a form
            </h2>
            <p className="mt-0.5 text-xs text-[color:var(--wsu-muted)]">
              Prefer a template when approval emails should go to the address entered on the form. Scratch sheets
              need Approval Request automations added later in Smartsheet.
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
          <div className="inline-flex rounded-lg border border-[color:var(--wsu-border)] p-0.5">
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
              <label htmlFor="create-form-template" className="mb-1 block text-xs text-[color:var(--wsu-muted)]">
                Template sheet
              </label>
              <select
                id="create-form-template"
                value={templateId}
                onChange={(e) => onTemplateIdChange(e.target.value)}
                className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm text-[color:var(--wsu-ink)] focus:border-wsu-crimson focus:outline-none focus:ring-1 focus:ring-wsu-crimson"
              >
                <option value="">Select a sheet…</option>
                {sheets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-[color:var(--wsu-muted)]">
                Best for approval notifications: clone a sheet whose Smartsheet automations request approval from
                contacts in the form’s Contact column. Rules copy when the API allows; you can still edit them in
                Smartsheet afterward.
              </p>
              {sheetsError ? (
                <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{sheetsError}</p>
              ) : null}
            </div>
          ) : (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              From scratch creates columns only — no Approval Request automations. After create, open the sheet in
              Smartsheet → Automation and request approval from contacts in the form’s Contact/email column, or
              use a template instead.
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <div>
              <label htmlFor="create-form-shareEmail" className="mb-1 block text-xs text-[color:var(--wsu-muted)]">
                Share with email <span className="text-[color:var(--wsu-muted)]/70">· optional</span>
              </label>
              <input
                id="create-form-shareEmail"
                type="email"
                placeholder="approver@wsu.edu"
                value={shareEmail}
                onChange={(e) => onShareEmailChange(e.target.value)}
                className="w-full rounded-lg border border-[color:var(--wsu-border)] px-3 py-2 text-sm text-[color:var(--wsu-ink)] placeholder:text-[color:var(--wsu-muted)] focus:border-wsu-crimson focus:outline-none focus:ring-1 focus:ring-wsu-crimson"
              />
            </div>
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
            disabled={creating}
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
