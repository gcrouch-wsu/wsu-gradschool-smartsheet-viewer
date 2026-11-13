import type { ViewFilterConfig } from "@/lib/config/types";

export const RUNNABLE_TEMPLATE_KINDS = [
  "alert",
  "move_row",
  "copy_row",
  "request_update_weekly",
  "request_update",
  "request_approval",
  "change_cell",
  "record_date",
  "assign_someone",
  "allow_row_changes",
  "prevent_row_changes",
] as const;

export type TemplateKind =
  | "alert"
  | "move_row"
  | "copy_row"
  | "request_update_weekly"
  | "request_update"
  | "request_approval"
  | "change_cell"
  | "record_date"
  | "assign_someone"
  | "allow_row_changes"
  | "prevent_row_changes";

export type TemplateCategory =
  | "notifications"
  | "sheet_to_sheet"
  | "update_approval"
  | "sheet_changes";

export type TriggerEvent = "row_created" | "row_updated" | "columns_changed";

export interface WorkflowTrigger {
  event: TriggerEvent;
  columnIds?: number[];
  delivery: "immediate" | "batched";
  /** Pacific day and time. "Every day" runs on each date after `time`. */
  schedule?: { day?: string; time?: string };
}

export type RunSource = "webhook" | "schedule" | "manual" | "retry";
export type RunStatus = "pending" | "sent" | "skipped" | "failed" | "waiting";

/** Delivery channels for alert workflows. `in_app` is live; `email` is reserved for a later mailer. */
export type NotificationChannel = "in_app" | "email";

export interface WorkflowAction {
  kind: string;
  recipients?: {
    userEmails?: string[];
    contactColumnId?: number;
  };
  /** Where to deliver alerts. Defaults to in-app when omitted. */
  channels?: NotificationChannel[];
  title?: string;
  body?: string;
  includeColumnIds?: number[];
  targetSheetId?: string;
  columnId?: number;
  value?: string;
}

export interface WorkflowRecord {
  id: string;
  sheetId: string;
  name: string;
  enabled: boolean;
  templateKind: TemplateKind;
  createdByEmail: string | null;
  trigger: WorkflowTrigger;
  conditions: ViewFilterConfig[];
  action: WorkflowAction;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowTemplate {
  kind: TemplateKind;
  category: TemplateCategory;
  categoryLabel: string;
  title: string;
  summary: string;
  runnable: boolean;
  greatWays: string[];
  howTo: { trigger: string; conditions: string; action: string };
  defaults: {
    name: string;
    trigger: WorkflowTrigger;
    conditions: ViewFilterConfig[];
    action: WorkflowAction;
  };
}

export interface NotificationPayload {
  sheetId: string;
  rowId: string | number | null;
  href?: string;
  fields: Array<{ title: string; value: string }>;
  templateKind: TemplateKind;
  /** Set while an approval is waiting for this person. */
  decision?: "pending" | "approved" | "declined";
  runId?: string;
}

export interface WorkflowRunRecord {
  id: string;
  workflowId: string;
  sheetId: string;
  rowId: string | null;
  eventKey: string;
  status: string;
  error: string | null;
  source: string;
  attemptCount: number;
  nextRetryAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface WorkflowDeliveryRecord {
  id: string;
  runId: string;
  recipientEmail: string;
  channel: string;
  status: string;
  error: string | null;
  createdAt: string;
}

export function isRunnableTemplateKind(kind: string): kind is (typeof RUNNABLE_TEMPLATE_KINDS)[number] {
  return (RUNNABLE_TEMPLATE_KINDS as readonly string[]).includes(kind);
}
