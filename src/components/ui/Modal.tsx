"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type ModalSize = "md" | "lg";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Optional accessible title; also shown as a header when provided. */
  title?: string;
  size?: ModalSize;
  /** Extra classes on the dialog panel. */
  className?: string;
}

const SIZE_CLASS: Record<ModalSize, string> = {
  md: "max-w-lg",
  lg: "max-w-2xl",
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

export function Modal({ open, onClose, children, title, size = "md", className }: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

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
    "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--wsu-border)] text-[color:var(--wsu-muted)] hover:bg-[color:var(--wsu-stone)] hover:text-[color:var(--wsu-ink)]";

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6">
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
        tabIndex={-1}
        className={cx(
          "relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-xl border border-[color:var(--wsu-border)] bg-white shadow-[0_20px_50px_rgba(35,31,32,0.2)] outline-none",
          SIZE_CLASS[size],
          className,
        )}
      >
        {title ? (
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[color:var(--wsu-border)] px-5 py-4">
            <h2 id={titleId} className="text-base font-medium text-[color:var(--wsu-ink)]">
              {title}
            </h2>
            <button type="button" onClick={onClose} className={closeButtonClass} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className={`absolute right-3 top-3 z-10 bg-white/90 ${closeButtonClass}`}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
