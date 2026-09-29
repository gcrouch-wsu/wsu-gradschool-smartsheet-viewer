"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

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
  /** Overlay stacking class; raise when nesting above another modal. */
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
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.focus();
    return () => {
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!mounted || !open) return null;

  const closeButtonClass =
    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[color:var(--wsu-border)] text-[color:var(--wsu-muted)] hover:bg-[color:var(--wsu-stone)] hover:text-[color:var(--wsu-ink)]";

  return createPortal(
    <div className={cx("fixed inset-0 flex items-center justify-center p-4 sm:p-6", zClass)}>
      <button
        type="button"
        className="absolute inset-0 bg-[color:var(--wsu-ink)]/40"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cx(
          "relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-xl border border-[color:var(--wsu-border)] bg-white shadow-[0_20px_50px_rgba(35,31,32,0.2)] outline-none",
          SIZE_CLASS[size],
          className,
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[color:var(--wsu-border)] px-5 py-4">
          <div className="min-w-0 flex-1">
            {title ? (
              <h2 id={titleId} className="text-base font-medium text-[color:var(--wsu-ink)]">
                {title}
              </h2>
            ) : (
              <span className="sr-only">Dialog</span>
            )}
            {description ? (
              <p id={descriptionId} className="mt-0.5 text-xs text-[color:var(--wsu-muted)]">
                {description}
              </p>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className={closeButtonClass} aria-label="Close">
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
      </div>
    </div>,
    document.body,
  );
}
