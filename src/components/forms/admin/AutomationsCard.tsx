"use client";

import { IconRefresh } from "@/components/forms/icons";

interface Rule {
  name?: string;
  enabled?: boolean;
}

interface AutomationsCardProps {
  rules: Rule[] | null;
  autoNotice: string;
  autoLoading: boolean;
  onLoad: () => void;
}

export function AutomationsCard({ rules, autoNotice, autoLoading, onLoad }: AutomationsCardProps) {
  const hasRules = rules && rules.length > 0;

  return (
    <div className="flex h-full flex-col rounded-xl border border-[color:var(--wsu-border)] bg-white p-4">
      <h2 className="text-sm font-medium text-[color:var(--wsu-ink)]">Automations</h2>
      <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">
        View single-action automation rules on the active sheet.
      </p>

      <div className="mt-4 flex-1">
        {!hasRules ? (
          <div className="rounded-lg bg-[color:var(--wsu-stone)] px-3 py-4 text-center text-xs text-[color:var(--wsu-muted)]">
            No automations loaded yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {rules!.map((rule, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg border border-[color:var(--wsu-border)] px-3 py-2 text-sm"
              >
                <span className="truncate text-[color:var(--wsu-ink)]">{rule.name || "(unnamed rule)"}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    rule.enabled !== false
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-[color:var(--wsu-stone)] text-[color:var(--wsu-muted)]"
                  }`}
                >
                  {rule.enabled !== false ? "Enabled" : "Disabled"}
                </span>
              </li>
            ))}
          </ul>
        )}
        {autoNotice ? (
          <p className="mt-3 rounded-lg bg-[color:var(--wsu-stone)] px-3 py-2 text-xs text-[color:var(--wsu-muted)]">
            {autoNotice}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onLoad}
        disabled={autoLoading}
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[color:var(--wsu-border)] bg-white py-2.5 text-sm font-medium text-[color:var(--wsu-ink)] hover:bg-[color:var(--wsu-stone)] disabled:opacity-50"
      >
        <IconRefresh className={`h-4 w-4 ${autoLoading ? "animate-spin" : ""}`} />
        {autoLoading ? "Loading…" : "Load automations"}
      </button>
    </div>
  );
}
