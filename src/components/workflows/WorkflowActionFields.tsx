"use client";

import { DEFAULT_ALERT_CHANNELS, resolveAlertChannels } from "@/lib/workflows/channels";
import type { NotificationChannel, WorkflowAction } from "@/lib/workflows/types";
import { workflowFieldClass, type WorkflowSheetColumn } from "@/components/workflows/shared";

function toggleChannel(channels: NotificationChannel[], channel: NotificationChannel, on: boolean) {
  const next = new Set(channels);
  if (on) next.add(channel);
  else next.delete(channel);
  if (!next.has("in_app") && !next.has("email")) next.add("in_app");
  return [...next];
}

export function WorkflowActionFields({
  action,
  templateKind,
  columns,
  contactColumns,
  people,
  runnable,
  onChange,
}: {
  action: WorkflowAction;
  templateKind: string;
  columns: WorkflowSheetColumn[];
  contactColumns: WorkflowSheetColumn[];
  people: string[];
  runnable: boolean;
  onChange: (action: WorkflowAction) => void;
}) {
  const emails = action.recipients?.userEmails ?? [];
  const channels = resolveAlertChannels(action.channels);

  return (
    <div className="space-y-4">
      {!runnable ? (
        <p className="rounded-lg bg-[color:var(--wsu-stone)] px-3 py-2 text-xs text-[color:var(--wsu-muted)]">
          This template can be saved, and it runs once it is enabled.
        </p>
      ) : null}

      {["alert", "request_update", "request_update_weekly", "request_approval", "assign_someone"].includes(templateKind) ? (
        <>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-[color:var(--wsu-ink)]">Deliver to</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-start gap-3 rounded-xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/30 p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={channels.includes("in_app")}
                  onChange={(e) =>
                    onChange({
                      ...action,
                      channels: toggleChannel(channels, "in_app", e.target.checked),
                    })
                  }
                />
                <span>
                  <span className="font-medium text-[color:var(--wsu-ink)]">In-app notification</span>
                  <span className="mt-0.5 block text-xs text-[color:var(--wsu-muted)]">
                    Live now — appears in the Notifications inbox.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-dashed border-[color:var(--wsu-border)] bg-white p-3 text-sm opacity-90">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={channels.includes("email")}
                  onChange={(e) =>
                    onChange({
                      ...action,
                      channels: toggleChannel(channels.length ? channels : DEFAULT_ALERT_CHANNELS, "email", e.target.checked),
                    })
                  }
                />
                <span>
                  <span className="font-medium text-[color:var(--wsu-ink)]">Email</span>
                  <span className="mt-0.5 block text-xs text-[color:var(--wsu-muted)]">
                    Recorded on the run. It sends when a mailer is configured; until then the run shows that email failed.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          <label className="block text-sm">
            <span className="font-medium text-[color:var(--wsu-ink)]">Specific people</span>
            <select
              className={`${workflowFieldClass} min-h-[7rem]`}
              multiple
              value={emails}
              onChange={(e) => {
                const selected = [...e.target.selectedOptions].map((opt) => opt.value);
                onChange({ ...action, recipients: { ...action.recipients, userEmails: selected } });
              }}
            >
              {people.map((email) => (
                <option key={email} value={email}>
                  {email}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-[color:var(--wsu-muted)]">Hold Ctrl/Cmd to select multiple.</span>
          </label>

          <label className="block text-sm">
            <span className="font-medium text-[color:var(--wsu-ink)]">Or type emails</span>
            <input
              className={workflowFieldClass}
              value={emails.join(", ")}
              placeholder="name@wsu.edu, other@wsu.edu"
              onChange={(e) =>
                onChange({
                  ...action,
                  recipients: {
                    ...action.recipients,
                    userEmails: e.target.value
                      .split(",")
                      .map((part) => part.trim())
                      .filter(Boolean),
                  },
                })
              }
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-[color:var(--wsu-ink)]">People in a Contact cell</span>
            <select
              className={workflowFieldClass}
              value={action.recipients?.contactColumnId ?? ""}
              onChange={(e) =>
                onChange({
                  ...action,
                  recipients: {
                    ...action.recipients,
                    contactColumnId: e.target.value ? Number(e.target.value) : undefined,
                  },
                })
              }
            >
              <option value="">None</option>
              {contactColumns.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.title}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="font-medium text-[color:var(--wsu-ink)]">Notification title</span>
            <input
              className={workflowFieldClass}
              value={action.title ?? ""}
              onChange={(e) => onChange({ ...action, title: e.target.value })}
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-[color:var(--wsu-ink)]">Notification body</span>
            <textarea
              className={workflowFieldClass}
              rows={4}
              value={action.body ?? ""}
              onChange={(e) => onChange({ ...action, body: e.target.value })}
            />
            <span className="mt-1 block text-xs text-[color:var(--wsu-muted)]">
              Tokens like {"{{Column Title}}"} are replaced from the row.
            </span>
          </label>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-[color:var(--wsu-ink)]">Fields to include</legend>
            <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/30 p-3">
              {columns.map((col) => {
                const checked = action.includeColumnIds?.includes(col.id) ?? false;
                return (
                  <label key={col.id} className="flex items-center gap-2 text-sm text-[color:var(--wsu-ink)]">
                    <input
                      type="checkbox"
                      className="rounded border-[color:var(--wsu-border)]"
                      checked={checked}
                      onChange={(e) => {
                        const current = new Set(action.includeColumnIds ?? []);
                        if (e.target.checked) current.add(col.id);
                        else current.delete(col.id);
                        onChange({ ...action, includeColumnIds: [...current] });
                      }}
                    />
                    {col.title}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </>
      ) : null}

      {templateKind === "move_row" || templateKind === "copy_row" ? (
        <label className="block text-sm">
          <span className="font-medium text-[color:var(--wsu-ink)]">Destination sheet id</span>
          <input
            className={workflowFieldClass}
            value={action.targetSheetId ?? ""}
            onChange={(e) => onChange({ ...action, targetSheetId: e.target.value })}
          />
        </label>
      ) : null}

      {templateKind === "change_cell" || templateKind === "record_date" || templateKind === "assign_someone" ? (
        <label className="block text-sm">
          <span className="font-medium text-[color:var(--wsu-ink)]">Column</span>
          <select
            className={workflowFieldClass}
            value={action.columnId ?? ""}
            onChange={(e) => onChange({ ...action, columnId: e.target.value ? Number(e.target.value) : undefined })}
          >
            <option value="">Select column</option>
            {columns.map((col) => (
              <option key={col.id} value={col.id}>
                {col.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {templateKind === "change_cell" ? (
        <label className="block text-sm">
          <span className="font-medium text-[color:var(--wsu-ink)]">Value</span>
          <input
            className={workflowFieldClass}
            value={action.value ?? ""}
            onChange={(e) => onChange({ ...action, value: e.target.value })}
          />
        </label>
      ) : null}
    </div>
  );
}
