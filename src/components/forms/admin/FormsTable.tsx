"use client";

import { IconCheck, IconFile, IconMore, IconSearch } from "@/components/forms/icons";

export interface FormEntryRow {
  id: string;
  name: string;
  createdAt: string;
  source: "template" | "scratch" | "imported" | "sample";
}

const SOURCE_LABEL: Record<FormEntryRow["source"], string> = {
  template: "Cloned",
  scratch: "From scratch",
  imported: "Added",
  sample: "Sample",
};

function truncateSheetId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

interface FormsTableProps {
  forms: FormEntryRow[];
  activeId: string;
  activePath: string;
  query: string;
  onQueryChange: (value: string) => void;
  onUseForm: (id: string) => void;
}

export function FormsTable({
  forms,
  activeId,
  activePath,
  query,
  onQueryChange,
  onUseForm,
}: FormsTableProps) {
  return (
    <div className="rounded-xl border border-[color:var(--wsu-border)] bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[color:var(--wsu-border)] px-4 py-3">
        <div>
          <h2 className="text-sm font-medium text-[color:var(--wsu-ink)]">Your forms</h2>
          <p className="mt-0.5 text-xs text-[color:var(--wsu-muted)]">Active path: {activePath || "—"}</p>
        </div>
        <div className="relative w-full sm:w-56">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--wsu-muted)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Filter by name or sheet ID"
            aria-label="Filter forms"
            className="w-full rounded-lg border border-[color:var(--wsu-border)] py-2 pl-9 pr-3 text-sm text-[color:var(--wsu-ink)] placeholder:text-[color:var(--wsu-muted)] focus:border-wsu-crimson focus:outline-none focus:ring-1 focus:ring-wsu-crimson"
          />
        </div>
      </div>

      {forms.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-[color:var(--wsu-muted)]">No forms yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[color:var(--wsu-border)] text-xs text-[color:var(--wsu-muted)]">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Source</th>
                <th className="px-4 py-2.5 font-medium">Sheet ID</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {forms.map((form) => {
                const isActive = String(form.id) === activeId;
                return (
                  <tr
                    key={form.id}
                    className="border-b border-[color:var(--wsu-border)] last:border-0 hover:bg-[color:var(--wsu-stone)]/60"
                  >
                    <td className="max-w-[200px] px-4 py-3">
                      <div className="flex items-center gap-2">
                        <IconFile className="h-4 w-4 shrink-0 text-[color:var(--wsu-muted)]" />
                        <span className="truncate font-medium text-[color:var(--wsu-ink)]">{form.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--wsu-muted)]">{SOURCE_LABEL[form.source]}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-[color:var(--wsu-muted)]" title={form.id}>
                        {truncateSheetId(form.id)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--wsu-muted)]">
                      {form.createdAt ? new Date(form.createdAt).toLocaleDateString() : ""}
                    </td>
                    <td className="px-4 py-3">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                          <IconCheck className="h-3 w-3" />
                          Active
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onUseForm(form.id)}
                          className="rounded-lg border border-[color:var(--wsu-border)] px-2.5 py-1 text-xs font-medium text-[color:var(--wsu-ink)] hover:bg-white"
                        >
                          Use
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-[color:var(--wsu-muted)] hover:bg-white hover:text-[color:var(--wsu-ink)]"
                        aria-label={`Actions for ${form.name}`}
                        onClick={() => !isActive && onUseForm(form.id)}
                      >
                        <IconMore />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
