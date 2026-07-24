"use client";

import { useEffect, useId, useRef } from "react";
import { Modal } from "@/components/ui/Modal";
import { inputClass, primaryBtnClass, secondaryBtnClass } from "@/components/forms/admin/AdminCard";

export interface DuplicateFormModalProps {
  open: boolean;
  onClose: () => void;
  sourceName: string;
  newName: string;
  onNewNameChange: (value: string) => void;
  duplicating: boolean;
  onConfirm: () => void;
  error?: string;
}

export function DuplicateFormModal({
  open,
  onClose,
  sourceName,
  newName,
  onNewNameChange,
  duplicating,
  onConfirm,
  error,
}: DuplicateFormModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const nameId = useId();

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  function handleClose() {
    if (!duplicating) onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Duplicate form" size="md">
      <div className="space-y-4 px-5 py-4">
        <p className="text-sm text-[color:var(--wsu-muted)]">
          Creates a new sheet and copies builder settings from{" "}
          <span className="font-medium text-[color:var(--wsu-ink)]">{sourceName || "this form"}</span>. The copy
          starts unpublished.
        </p>

        <div>
          <label htmlFor={nameId} className="mb-1 block text-xs text-[color:var(--wsu-muted)]">
            New sheet name
          </label>
          <input
            ref={inputRef}
            id={nameId}
            type="text"
            value={newName}
            disabled={duplicating}
            onChange={(e) => onNewNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !duplicating && newName.trim()) {
                e.preventDefault();
                onConfirm();
              }
            }}
            className={inputClass}
            placeholder="e.g. Graduate Leave — Fall 2026"
            autoComplete="off"
          />
        </div>

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2 border-t border-[color:var(--wsu-border)] pt-4">
          <button type="button" className={secondaryBtnClass} disabled={duplicating} onClick={handleClose}>
            Cancel
          </button>
          <button
            type="button"
            className={primaryBtnClass}
            disabled={duplicating || !newName.trim()}
            onClick={onConfirm}
          >
            {duplicating ? "Duplicating…" : "Duplicate"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
