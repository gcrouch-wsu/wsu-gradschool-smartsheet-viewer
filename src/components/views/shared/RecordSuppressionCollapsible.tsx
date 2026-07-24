import type { ReactNode } from "react";
import { getRowHeadingText } from "@/components/views/layouts/layout-utils";
import type { ResolvedView, ResolvedViewRow } from "@/lib/config/types";

/**
 * Collapsed public shell when a row is status-suppressed (e.g. Hide / Delete on a file record).
 * Edit controls should stay outside this wrapper. Print CSS expands the body (see globals.css).
 */
export function RecordSuppressionCollapsible({
  view,
  row,
  children,
}: {
  view: ResolvedView;
  row: ResolvedViewRow;
  children: ReactNode;
}) {
  const s = row.recordSuppression;
  if (!s) {
    return <>{children}</>;
  }

  const headingHint = getRowHeadingText(view, row);

  return (
    <details className="rsup-collapsible border-0 bg-transparent p-0">
      <summary className="rsup-collapsible-summary mb-3 flex cursor-pointer flex-wrap items-center gap-2 rounded-xl border border-amber-200/90 bg-amber-50/80 px-3 py-2 text-left marker:text-[color:var(--wsu-crimson)]">
        <span className="rounded-full border border-amber-300/90 bg-amber-100/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950">
          {s.statusDisplay}
        </span>
        <span className="min-w-0 text-sm text-[color:var(--wsu-muted)]">{headingHint}</span>
      </summary>
      <div className="rsup-collapsible-body">{children}</div>
    </details>
  );
}
