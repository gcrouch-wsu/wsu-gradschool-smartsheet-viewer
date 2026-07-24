"use client";

import { FILTER_OPERATOR_OPTIONS } from "@/lib/config/options";
import type { ViewConfig, ViewFilterConfig, ViewSortConfig } from "@/lib/config/types";
import type { SmartsheetSchemaSummary } from "@/lib/smartsheet";
import { createEmptyFilter, createEmptySort, parseOptionalNumber } from "./view-builder-utils";

export function ViewBuilderFiltersTab({
  view,
  update,
  updateFilter,
  updateSort,
  schema,
}: {
  view: ViewConfig;
  update: <K extends keyof ViewConfig>(key: K, value: ViewConfig[K]) => void;
  updateFilter: (index: number, nextFilter: ViewFilterConfig) => void;
  updateSort: (index: number, nextSort: ViewSortConfig) => void;
  schema: SmartsheetSchemaSummary | null;
}) {
  return (
    <div id="tabpanel-filters" role="tabpanel" aria-labelledby="tab-filters" className="mt-6 space-y-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-[color:var(--wsu-ink)]">Filters</h2>
                <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">
                  Configure row inclusion rules. For a “Public Visibility” column, use <strong className="font-medium">not in</strong> with
                  comma-separated <code className="text-xs">Hide, Delete</code> to drop hidden rows from the public view.
                </p>
              </div>
              <button
                type="button"
                onClick={() => update("filters", [...(view.filters ?? []), createEmptyFilter()])}
                className="rounded-full border border-[color:var(--wsu-border)] bg-white px-3 py-1.5 text-sm font-medium"
              >
                Add filter
              </button>
            </div>
            <div className="space-y-4">
              {(view.filters ?? []).map((filter, index) => (
                <div key={`${filter.columnTitle ?? filter.columnId ?? "filter"}-${index}`} className="grid gap-3 rounded-2xl border border-[color:var(--wsu-border)] bg-white p-4 md:grid-cols-[1fr_180px_1fr_auto]">
                  {schema ? (
                    <select
                      value={filter.columnId ?? ""}
                      onChange={(event) => {
                        const colId = parseOptionalNumber(event.target.value);
                        const col = schema.columns.find((c) => c.id === colId);
                        updateFilter(index, {
                          ...filter,
                          columnId: colId,
                          columnTitle: col?.title ?? "",
                          columnType: col?.type,
                        });
                      }}
                      className="rounded-xl border border-[color:var(--wsu-border)] px-3 py-2 min-h-[44px]"
                    >
                      <option value="">Select column</option>
                      {schema.columns.map((col) => (
                        <option key={col.id} value={col.id}>
                          {col.title} ({col.type ?? "TEXT_NUMBER"})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex gap-2 md:col-span-1">
                      <input
                        value={filter.columnTitle ?? ""}
                        onChange={(event) => updateFilter(index, { ...filter, columnTitle: event.target.value })}
                        placeholder="Column title"
                        className="min-w-0 flex-1 rounded-xl border border-[color:var(--wsu-border)] px-3 py-2"
                      />
                      <input
                        type="number"
                        value={filter.columnId ?? ""}
                        onChange={(event) => updateFilter(index, { ...filter, columnId: parseOptionalNumber(event.target.value) })}
                        placeholder="ID"
                        className="w-20 rounded-xl border border-[color:var(--wsu-border)] px-3 py-2"
                      />
                    </div>
                  )}
                  <select
                    value={filter.op}
                    onChange={(event) => updateFilter(index, { ...filter, op: event.target.value as ViewFilterConfig["op"] })}
                    className="rounded-xl border border-[color:var(--wsu-border)] px-3 py-2"
                  >
                    {FILTER_OPERATOR_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  {schema &&
                  filter.columnId &&
                  schema.columns.find((c) => c.id === filter.columnId)?.options &&
                  filter.op !== "in" &&
                  filter.op !== "not_in" ? (
                    <select
                      value={String(filter.value ?? "")}
                      onChange={(event) => updateFilter(index, { ...filter, value: event.target.value })}
                      className="rounded-xl border border-[color:var(--wsu-border)] px-3 py-2 min-h-[44px]"
                    >
                      <option value="">Select value</option>
                      {schema.columns
                        .find((c) => c.id === filter.columnId)
                        ?.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <input
                      value={Array.isArray(filter.value) ? filter.value.join(", ") : String(filter.value ?? "")}
                      onChange={(event) => {
                        const raw = event.target.value;
                        const value =
                          filter.op === "in" || filter.op === "not_in"
                            ? raw.split(",").map((s) => s.trim()).filter(Boolean)
                            : raw;
                        updateFilter(index, { ...filter, value });
                      }}
                      placeholder={filter.op === "in" || filter.op === "not_in" ? "Comma-separated values" : "Value"}
                      className="rounded-xl border border-[color:var(--wsu-border)] px-3 py-2"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => update("filters", (view.filters ?? []).filter((_, filterIndex) => filterIndex !== index))}
                    className="rounded-full border border-rose-200 px-3 py-2 text-sm text-rose-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {(view.filters ?? []).length === 0 && <p className="text-sm text-[color:var(--wsu-muted)]">No filters configured.</p>}
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-[color:var(--wsu-ink)]">Sort order</h2>
                <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">Configure default row ordering.</p>
              </div>
              <button
                type="button"
                onClick={() => update("defaultSort", [...(view.defaultSort ?? []), createEmptySort()])}
                className="rounded-full border border-[color:var(--wsu-border)] bg-white px-3 py-1.5 text-sm font-medium"
              >
                Add sort
              </button>
            </div>
            <div className="space-y-4">
              {(view.defaultSort ?? []).map((sort, index) => (
                <div key={`${sort.field}-${index}`} className="grid gap-3 rounded-2xl border border-[color:var(--wsu-border)] bg-white p-4 md:grid-cols-[1fr_180px_auto]">
                  <select
                    value={sort.field}
                    onChange={(event) => updateSort(index, { ...sort, field: event.target.value})}
                    className="rounded-xl border border-[color:var(--wsu-border)] px-3 py-2 min-h-[44px]"
                  >
                    <option value="">Select field</option>
                    {view.fields.map((f) => (
                      <option key={f.key} value={f.key}>{f.label || f.key}</option>
                    ))}
                  </select>
                  <select
                    value={sort.direction}
                    onChange={(event) => updateSort(index, { ...sort, direction: event.target.value as ViewSortConfig["direction"] })}
                    className="rounded-xl border border-[color:var(--wsu-border)] px-3 py-2"
                  >
                    <option value="asc">asc</option>
                    <option value="desc">desc</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => update("defaultSort", (view.defaultSort ?? []).filter((_, sortIndex) => sortIndex !== index))}
                    className="rounded-full border border-rose-200 px-3 py-2 text-sm text-rose-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {(view.defaultSort ?? []).length === 0 && <p className="text-sm text-[color:var(--wsu-muted)]">No sort configured.</p>}
            </div>
    </div>
  );
}
