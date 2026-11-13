"use client";

import type { WorkflowTrigger } from "@/lib/workflows/types";
import { workflowFieldClass, type WorkflowSheetColumn } from "@/components/workflows/shared";

export function WorkflowTriggerFields({
  name,
  trigger,
  columns,
  weekly,
  onName,
  onTrigger,
}: {
  name: string;
  trigger: WorkflowTrigger;
  columns: WorkflowSheetColumn[];
  weekly?: boolean;
  onName: (name: string) => void;
  onTrigger: (trigger: WorkflowTrigger) => void;
}) {
  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="font-medium text-[color:var(--wsu-ink)]">Workflow name</span>
        <input
          className={workflowFieldClass}
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder="Alert someone when something happens"
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium text-[color:var(--wsu-ink)]">When this happens</span>
        <select
          className={workflowFieldClass}
          value={trigger.event}
          onChange={(e) => onTrigger({ ...trigger, event: e.target.value as WorkflowTrigger["event"] })}
        >
          <option value="row_created">A row is added</option>
          <option value="row_updated">A row changes</option>
          <option value="columns_changed">Specific columns change</option>
        </select>
      </label>

      {trigger.event === "columns_changed" ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-[color:var(--wsu-ink)]">Watched columns</legend>
          <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/30 p-3">
            {columns.length === 0 ? (
              <p className="text-xs text-[color:var(--wsu-muted)]">No columns loaded for this sheet.</p>
            ) : (
              columns.map((col) => {
                const checked = trigger.columnIds?.includes(col.id) ?? false;
                return (
                  <label key={col.id} className="flex items-center gap-2 text-sm text-[color:var(--wsu-ink)]">
                    <input
                      type="checkbox"
                      className="rounded border-[color:var(--wsu-border)]"
                      checked={checked}
                      onChange={(e) => {
                        const current = new Set(trigger.columnIds ?? []);
                        if (e.target.checked) current.add(col.id);
                        else current.delete(col.id);
                        onTrigger({ ...trigger, columnIds: [...current] });
                      }}
                    />
                    {col.title}
                  </label>
                );
              })
            )}
          </div>
        </fieldset>
      ) : null}

      <label className="block text-sm">
        <span className="font-medium text-[color:var(--wsu-ink)]">Delivery</span>
        <select
          className={workflowFieldClass}
          value={trigger.delivery}
          onChange={(e) =>
            onTrigger({
              ...trigger,
              delivery: e.target.value === "batched" ? "batched" : "immediate",
              schedule:
                e.target.value === "batched"
                  ? { day: trigger.schedule?.day || "Every day", time: trigger.schedule?.time || "09:00" }
                  : trigger.schedule,
            })
          }
        >
          <option value="immediate">Immediately</option>
          <option value="batched">Once a day, grouped</option>
        </select>
      </label>

      <p className="rounded-lg bg-[color:var(--wsu-stone)]/50 px-3 py-2 text-xs text-[color:var(--wsu-muted)]">
        A failed run stays on the workflow list and tries again after 60 seconds, up to three times.
      </p>

      {weekly || trigger.delivery === "batched" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-[color:var(--wsu-ink)]">Day</span>
            <input
              className={workflowFieldClass}
              value={trigger.schedule?.day ?? "Monday"}
              onChange={(e) => onTrigger({ ...trigger, schedule: { ...trigger.schedule, day: e.target.value } })}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[color:var(--wsu-ink)]">Time</span>
            <input
              className={workflowFieldClass}
              value={trigger.schedule?.time ?? "09:00"}
              onChange={(e) => onTrigger({ ...trigger, schedule: { ...trigger.schedule, time: e.target.value } })}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
