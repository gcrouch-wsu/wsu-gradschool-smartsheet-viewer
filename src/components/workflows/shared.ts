export interface WorkflowSheetColumn {
  id: number;
  title: string;
  type: string;
}

export const workflowFieldClass =
  "mt-1.5 w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm text-[color:var(--wsu-ink)] shadow-sm focus:border-[color:var(--wsu-crimson)] focus:outline-none focus:ring-2 focus:ring-[color:var(--wsu-crimson)]/20";

export const workflowSecondaryBtnClass =
  "inline-flex items-center justify-center rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm font-medium text-[color:var(--wsu-ink)] transition hover:bg-[color:var(--wsu-stone)]/60 disabled:opacity-50";

export const workflowPrimaryBtnClass =
  "inline-flex items-center justify-center rounded-lg bg-[color:var(--wsu-crimson)] px-3 py-2 text-sm font-medium text-white transition hover:bg-[color:var(--wsu-crimson-dark,#8a1538)] disabled:opacity-60";
