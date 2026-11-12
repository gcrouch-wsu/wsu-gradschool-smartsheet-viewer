"use client";

import { useEffect, useId, useLayoutEffect, useRef, type ReactNode, type SyntheticEvent } from "react";

type ModalSize = "md" | "lg" | "xl" | "3xl";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Optional accessible title; also shown as a header when provided. */
  title?: string;
  /** Optional subtitle under the title in the header. */
  description?: string;
  size?: ModalSize;
  /** Extra classes on the dialog panel. */
  className?: string;
  /**
   * Kept for existing callers. Modal dialogs stack in top-layer open order,
   * so a dialog opened later paints above one opened earlier.
   */
  zClass?: string;
  /** When false, body content is not padded (full-bleed layouts). Default true. */
  padded?: boolean;
}

const SIZE_CLASS: Record<ModalSize, string> = {
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  "3xl": "max-w-3xl",
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function CloseIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

function pointerOutside(event: PointerEvent, dialog: HTMLDialogElement) {
  const rect = dialog.getBoundingClientRect();
  return (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );
}

export function Modal({
  open,
  onClose,
  children,
  title,
  description,
  size = "md",
  className,
  zClass = "z-[10000]",
  padded = true,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const openRef = useRef(open);
  const ignoreCloseRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  onCloseRef.current = onClose;
  openRef.current = open;

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      ignoreCloseRef.current = true;
      dialog.close();
    }

    return () => {
      if (dialog.open) {
        ignoreCloseRef.current = true;
        dialog.close();
      }
    };
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // `closedby="any"` misses presses in the dialog margin, where the event
    // target is the dialog but the point is outside its border box.
    let pressedOutside = false;
    const onPointerDown = (event: PointerEvent) => {
      pressedOutside = pointerOutside(event, dialog);
    };
    const onPointerUp = (event: PointerEvent) => {
      const shouldClose = pressedOutside && pointerOutside(event, dialog);
      pressedOutside = false;
      if (shouldClose) onCloseRef.current();
    };

    dialog.addEventListener("pointerdown", onPointerDown);
    dialog.addEventListener("pointerup", onPointerUp);
    return () => {
      dialog.removeEventListener("pointerdown", onPointerDown);
      dialog.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  function requestClose() {
    onCloseRef.current();
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    // `open` stays under the parent. Esc still fires `cancel` where `closedby` is missing.
    event.preventDefault();
    requestClose();
  }

  function handleDialogClose() {
    if (ignoreCloseRef.current) {
      ignoreCloseRef.current = false;
      return;
    }
    requestClose();
    // If the parent refuses to close (for example while a confirm is busy), reopen.
    requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (dialog && openRef.current && !dialog.open) dialog.showModal();
    });
  }

  const closeButtonClass =
    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[color:var(--wsu-border)] text-[color:var(--wsu-muted)] hover:bg-[color:var(--wsu-stone)] hover:text-[color:var(--wsu-ink)]";

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : "Dialog"}
      aria-describedby={description ? descriptionId : undefined}
      className={cx(
        "wsu-modal w-[calc(100%-2rem)] rounded-xl border border-[color:var(--wsu-border)] bg-white text-[color:var(--wsu-ink)] shadow-[0_20px_50px_rgba(35,31,32,0.2)]",
        SIZE_CLASS[size],
        zClass,
        className,
      )}
      onCancel={handleCancel}
      onClose={handleDialogClose}
    >
      {open ? (
        <>
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[color:var(--wsu-border)] px-5 py-4">
            <div className="min-w-0 flex-1">
              {title ? (
                <h2 id={titleId} className="text-base font-medium text-[color:var(--wsu-ink)]">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p id={descriptionId} className="mt-0.5 text-xs text-[color:var(--wsu-muted)]">
                  {description}
                </p>
              ) : null}
            </div>
            <button type="button" onClick={requestClose} className={closeButtonClass} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <div
            className={cx(
              "min-h-0 flex-1 overflow-y-auto overscroll-contain",
              padded && "px-5 py-4",
            )}
          >
            {children}
          </div>
        </>
      ) : null}
    </dialog>
  );
}
