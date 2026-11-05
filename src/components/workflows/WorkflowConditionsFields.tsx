"use client";

import { FILTER_OPERATOR_OPTIONS } from "@/lib/config/options";
import type { ViewFilterConfig } from "@/lib/config/types";
import {
  workflowFieldClass,
  workflowSecondaryBtnClass,
  type WorkflowSheetColumn,
} from "@/components/workflows/shared";

export function emptyWorkflowCondition(): ViewFilterConfig {
  return { columnId: undefined, columnTitle: "", op: "equals", value: "" };
}

function valueHint(op: ViewFilterConfig["op"]): string {
  if (op === "is_empty" || op === "not_empty") {
    return "No value needed for this comparison.";
  }
  if (op === "is_after" || op === "is_before") {
    return "Enter a date (YYYY-MM-DD) or the word today.";
  }
  if (op === "contains" || op === "not_contains") {
    return "Enter text that should appear in the cell.";
  }
  if (op === "in" || op === "not_in") {
    return "Enter one value, or several separated by commas.";
  }
  return "Enter the exact cell value to match, or today for the current date.";
}

function valuePlaceholder(op: ViewFilterConfig["op"]): string {
  if (op === "is_empty" || op === "not_empty") return "—";
  if (op === "is_after" || op === "is_before") return "today or 2026-11-05";
  if (op === "in" || op === "not_in") return "Approved, Pending";
  return "Exact value or today";
}

export function WorkflowConditionsFields({
  conditions,
  columns,
  onChange,
}: {
  conditions: ViewFilterConfig[];
  columns: WorkflowSheetColumn[];
  onChange: (conditions: ViewFilterConfig[]) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[color:var(--wsu-muted)]">
        Optional. All conditions must match. Leave empty to run for every matching trigger.
      </p>

      {conditions.map((filter, index) => {
        const needsValue = filter.op !== "is_empty" && filter.op !== "not_empty";
        return (
          <div
            key={index}
            className="space-y-3 rounded-xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/20 p-3"
          >
            <div className="grid gap-3 md:grid-cols-[1fr_160px_1fr_auto] md:items-end">
              <label className="block text-sm">
                <span className="font-medium text-[color:var(--wsu-ink)]">Column</span>
                <select
                  className={workflowFieldClass}
                  value={filter.columnId ?? ""}
                  onChange={(e) => {
                    const col = columns.find((item) => item.id === Number(e.target.value));
                    const next = [...conditions];
                    next[index] = {
                      ...filter,
                      columnId: col?.id,
                      columnTitle: col?.title ?? "",
                      columnType: col?.type,
                    };
                    onChange(next);
                  }}
                >
                  <option value="">Choose a column</option>
                  {columns.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="font-medium text-[color:var(--wsu-ink)]">Comparison</span>
                <select
                  className={workflowFieldClass}
                  value={filter.op}
                  onChange={(e) => {
                    const next = [...conditions];
                    next[index] = { ...filter, op: e.target.value as ViewFilterConfig["op"] };
                    onChange(next);
                  }}
                >
                  {FILTER_OPERATOR_OPTIONS.map((op) => (
                    <option key={op} value={op}>
                      {op.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="font-medium text-[color:var(--wsu-ink)]">Value</span>
                <input
                  className={workflowFieldClass}
                  value={String(filter.value ?? "")}
                  placeholder={valuePlaceholder(filter.op)}
                  disabled={!needsValue}
                  list={`workflow-condition-value-suggestions-${index}`}
                  onChange={(e) => {
                    const next = [...conditions];
                    next[index] = { ...filter, value: e.target.value };
                    onChange(next);
                  }}
                />
                <datalist id={`workflow-condition-value-suggestions-${index}`}>
                  <option value="today" />
                </datalist>
              </label>

              <button
                type="button"
                className={`${workflowSecondaryBtnClass} md:mb-0.5`}
                onClick={() => onChange(conditions.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
            <p className="text-xs text-[color:var(--wsu-muted)]">{valueHint(filter.op)}</p>
          </div>
        );
      })}

      <button
        type="button"
        className={workflowSecondaryBtnClass}
        onClick={() => onChange([...conditions, emptyWorkflowCondition()])}
      >
        Add condition
      </button>
    </div>
  );
}
