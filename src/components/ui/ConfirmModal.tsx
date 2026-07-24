"use client";

import { Modal } from "@/components/ui/Modal";
import { primaryBtnClass, secondaryBtnClass } from "@/components/forms/admin/AdminCard";

export interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive styling for delete-style actions. */
  danger?: boolean;
  busy?: boolean;
  busyLabel?: string;
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  busyLabel,
}: ConfirmModalProps) {
  function handleClose() {
    if (!busy) onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title={title} size="md">
      <div className="space-y-4 px-5 py-4">
        <p className="text-sm text-[color:var(--wsu-muted)]">{message}</p>
        <div className="flex flex-wrap justify-end gap-2 border-t border-[color:var(--wsu-border)] pt-4">
          <button type="button" className={secondaryBtnClass} disabled={busy} onClick={handleClose}>
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={
              danger
                ? "rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
                : primaryBtnClass
            }
          >
            {busy ? busyLabel || "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
