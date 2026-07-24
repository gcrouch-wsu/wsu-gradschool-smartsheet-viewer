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
      className={`rounded-full border border-[color:var(--wsu-crimson)] bg-white font-medium text-[color:var(--wsu-crimson)] transition hover:bg-[color:var(--wsu-crimson)] hover:text-white ${compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"} ${className}`}
    >
      Edit
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
