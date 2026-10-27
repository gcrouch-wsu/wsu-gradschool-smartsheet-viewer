import type { MouseEvent } from "react";

export function getContributorRowAccentClass(isEditable: boolean) {
  return isEditable
    ? "border-l-4 border-l-[color:var(--wsu-crimson)] bg-[color:var(--wsu-crimson)]/5"
    : "";
}

export function ContributorEditButton({
  rowId,
  onEditRow,
  className = "",
  compact = false,
  stopPropagation = false,
}: {
  rowId: number;
  onEditRow?: (rowId: number, triggerElement?: HTMLElement | null) => void;
  className?: string;
  compact?: boolean;
  stopPropagation?: boolean;
}) {
  if (!onEditRow) {
    return null;
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (stopPropagation) {
      event.preventDefault();
      event.stopPropagation();
    }
    onEditRow?.(rowId, event.currentTarget);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Edit"
      title="Edit"
      className={`inline-flex items-center justify-center rounded-full border border-[color:var(--wsu-crimson)] bg-white text-[color:var(--wsu-crimson)] transition hover:bg-[color:var(--wsu-crimson)] hover:text-white ${compact ? "h-8 w-8" : "h-9 w-9"} ${className}`}
    >
      <svg
        className={compact ? "h-3.5 w-3.5" : "h-4 w-4"}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    </button>
  );
}

export function ContributorEditableBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`rounded-full bg-[color:var(--wsu-crimson)]/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-crimson)] ${className}`}
    >
      Editable
    </span>
  );
}
