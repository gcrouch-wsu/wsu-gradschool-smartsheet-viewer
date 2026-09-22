import type { WorkflowTemplate, TemplateKind } from "@/lib/workflows/types";

const later = "You can configure this now; it will not run until a later plan.";

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    kind: "alert",
    category: "notifications",
    categoryLabel: "Notifications and reminders",
    title: "Alert someone when something happens",
    summary: "Notify people in this app when critical information, dates, or phases change.",
    runnable: true,
    greatWays: [
      "Notify stakeholders about changes to critical information or at-risk statuses",
      "Keep teammates in the loop when assigning them tasks or changing dates",
      "Alert stakeholders when projects change phases",
    ],
    howTo: {
      trigger:
        "Select the sheet change that triggers this workflow. Alerts are sent immediately. Batched delivery comes in a later plan.",
      conditions:
        "Fine-tune which rows get sent in an alert, such as excluding completed tasks or only including rows with future start dates.",
      action:
        "Alert specific people or people in a Contact cell. Customize the title, body, and which fields to include. Email, Slack, Teams, and everyone shared to the sheet come later.",
    },
    defaults: {
      name: "Alert someone when something happens",
      trigger: { event: "row_updated", delivery: "immediate" },
      conditions: [],
      action: {
        kind: "in_app_notification",
        recipients: { userEmails: [] },
        title: "Update on {{Primary}}",
        body: "A row changed. Review the details below.",
        includeColumnIds: [],
      },
    },
  },
  {
    kind: "move_row",
    category: "sheet_to_sheet",
    categoryLabel: "Sheet to sheet",
    title: "Move a row to another sheet when specified criteria are met",
    summary: "Move matching rows to another sheet after conditions are met.",
    runnable: false,
    greatWays: [
      "Archive completed work onto a history sheet",
      "Hand a row to another team when a phase changes",
    ],
    howTo: {
      trigger: "Choose the sheet change that should move the row.",
      conditions: "Define which rows are eligible to move.",
      action: "Choose the destination sheet. Moving rows is not available yet — this saves as a draft.",
    },
    defaults: {
      name: "Move a row to another sheet",
      trigger: { event: "row_updated", delivery: "immediate" },
      conditions: [],
      action: { kind: "move_row", targetSheetId: "" },
    },
  },
  {
    kind: "copy_row",
    category: "sheet_to_sheet",
    categoryLabel: "Sheet to sheet",
    title: "Copy a row to another sheet when specified criteria are met",
    summary: "Copy matching rows to another sheet without removing the original.",
    runnable: false,
    greatWays: [
      "Start a related request on another sheet when a row is approved",
      "Share a snapshot of a row with another team",
    ],
    howTo: {
      trigger: "Choose the sheet change that should copy the row.",
      conditions: "Define which rows should be copied.",
      action: "Choose the destination sheet. Copying rows is not available yet — this saves as a draft.",
    },
    defaults: {
      name: "Copy a row to another sheet",
      trigger: { event: "row_updated", delivery: "immediate" },
      conditions: [],
      action: { kind: "copy_row", targetSheetId: "" },
    },
  },
  {
    kind: "request_update_weekly",
    category: "update_approval",
    categoryLabel: "Update and approval requests",
    title: "Request an update every week",
    summary: "Ask someone for an update on a repeating schedule.",
    runnable: false,
    greatWays: [
      "Ask owners for a weekly status on open work",
      "Remind contacts before a recurring deadline",
    ],
    howTo: {
      trigger: "Specify the day and time this should run. Scheduling is saved but not executed yet.",
      conditions: "Limit which rows are included, such as unfinished tasks.",
      action: "Choose who should be asked. Weekly update requests are a later plan.",
    },
    defaults: {
      name: "Request an update every week",
      trigger: { event: "row_updated", delivery: "batched", schedule: { day: "Monday", time: "09:00" } },
      conditions: [],
      action: { kind: "request_update", recipients: { userEmails: [] }, title: "Weekly update", body: "Please update this row." },
    },
  },
  {
    kind: "request_update",
    category: "update_approval",
    categoryLabel: "Update and approval requests",
    title: "Request an update when specified criteria are met",
    summary: "Ask someone to fill in cells when a row matches your conditions.",
    runnable: false,
    greatWays: [
      "Ask the assignee to complete missing fields",
      "Request a status update when a date slips",
    ],
    howTo: {
      trigger: "Select the sheet change that should request an update.",
      conditions: "Fine-tune which rows need an update.",
      action: "Choose the people or Contact cell to ask. Update requests in this app are a later plan.",
    },
    defaults: {
      name: "Request an update when criteria are met",
      trigger: { event: "row_updated", delivery: "immediate" },
      conditions: [],
      action: { kind: "request_update", recipients: { userEmails: [] }, title: "Update requested", body: "Please update this row." },
    },
  },
  {
    kind: "request_approval",
    category: "update_approval",
    categoryLabel: "Update and approval requests",
    title: "Request an approval when specified criteria are met",
    summary: "Ask someone to approve or decline a row when conditions are met.",
    runnable: false,
    greatWays: [
      "Request approval when a submission is ready",
      "Notify the next approver when a stage is complete",
    ],
    howTo: {
      trigger: "Select the sheet change that should request approval.",
      conditions: "Include only rows that are ready for review.",
      action:
        "Choose the approver. Smartsheet approval emails stay on until you turn them off. In-app approval requests are a later plan.",
    },
    defaults: {
      name: "Request an approval when criteria are met",
      trigger: { event: "row_updated", delivery: "immediate" },
      conditions: [],
      action: { kind: "request_approval", recipients: { userEmails: [] }, title: "Approval requested", body: "Please review this row." },
    },
  },
  {
    kind: "change_cell",
    category: "sheet_changes",
    categoryLabel: "Sheet changes",
    title: "Change a cell value when specified criteria are met",
    summary: "Write a value into a column when a row matches your conditions.",
    runnable: false,
    greatWays: [
      "Set a status when another column changes",
      "Clear a field when a task is complete",
    ],
    howTo: {
      trigger: "Select the sheet change that should update the cell.",
      conditions: "Define which rows should be updated.",
      action: "Choose the column and value to write. Cell updates are a later plan.",
    },
    defaults: {
      name: "Change a cell value",
      trigger: { event: "row_updated", delivery: "immediate" },
      conditions: [],
      action: { kind: "change_cell", value: "" },
    },
  },
  {
    kind: "record_date",
    category: "sheet_changes",
    categoryLabel: "Sheet changes",
    title: "Record the date when specified criteria are met",
    summary: "Stamp today’s date into a date column when conditions are met.",
    runnable: false,
    greatWays: [
      "Record when a row first becomes at risk",
      "Stamp the date a phase changes",
    ],
    howTo: {
      trigger: "Select the sheet change that should record the date.",
      conditions: "Define which rows should be stamped.",
      action: "Choose the date column. Recording dates is a later plan.",
    },
    defaults: {
      name: "Record the date",
      trigger: { event: "row_updated", delivery: "immediate" },
      conditions: [],
      action: { kind: "record_date" },
    },
  },
  {
    kind: "assign_someone",
    category: "sheet_changes",
    categoryLabel: "Sheet changes",
    title: "Assign someone when specified criteria are met",
    summary: "Put a person in a Contact cell when conditions are met.",
    runnable: false,
    greatWays: [
      "Assign a reviewer when a row reaches a phase",
      "Route work to a contact when a status changes",
    ],
    howTo: {
      trigger: "Select the sheet change that should assign someone.",
      conditions: "Define which rows should be assigned.",
      action: "Choose the Contact column and the person. Assigning people is a later plan.",
    },
    defaults: {
      name: "Assign someone",
      trigger: { event: "row_updated", delivery: "immediate" },
      conditions: [],
      action: { kind: "assign_someone", recipients: { userEmails: [] } },
    },
  },
  {
    kind: "allow_row_changes",
    category: "sheet_changes",
    categoryLabel: "Sheet changes",
    title: "Allow changes to a row when specified criteria are met",
    summary: "Unlock a row for editing when conditions are met.",
    runnable: false,
    greatWays: [
      "Unlock a row after it is returned for changes",
      "Allow edits only while a status is in progress",
    ],
    howTo: {
      trigger: "Select the sheet change that should unlock the row.",
      conditions: "Define which rows should become editable.",
      action: "Row locking is a later plan. This saves as a draft.",
    },
    defaults: {
      name: "Allow changes to a row",
      trigger: { event: "row_updated", delivery: "immediate" },
      conditions: [],
      action: { kind: "allow_row_changes" },
    },
  },
  {
    kind: "prevent_row_changes",
    category: "sheet_changes",
    categoryLabel: "Sheet changes",
    title: "Prevent changes to a row when specified criteria are met",
    summary: "Lock a row so it cannot be edited when conditions are met.",
    runnable: false,
    greatWays: [
      "Lock completed rows",
      "Prevent edits after a row is approved",
    ],
    howTo: {
      trigger: "Select the sheet change that should lock the row.",
      conditions: "Define which rows should be locked, such as completed tasks.",
      action: "Row locking is a later plan. This saves as a draft.",
    },
    defaults: {
      name: "Prevent changes to a row",
      trigger: { event: "row_updated", delivery: "immediate" },
      conditions: [],
      action: { kind: "prevent_row_changes" },
    },
  },
];

const byKind = new Map(WORKFLOW_TEMPLATES.map((template) => [template.kind, template]));

export function getWorkflowTemplate(kind: string): WorkflowTemplate | null {
  return byKind.get(kind as TemplateKind) ?? null;
}

export function workflowCategories(): Array<{ id: WorkflowTemplate["category"]; label: string; templates: WorkflowTemplate[] }> {
  const order: WorkflowTemplate["category"][] = [
    "notifications",
    "sheet_to_sheet",
    "update_approval",
    "sheet_changes",
  ];
  return order.map((id) => {
    const templates = WORKFLOW_TEMPLATES.filter((template) => template.category === id);
    return { id, label: templates[0]?.categoryLabel ?? id, templates };
  });
}

export { later as LATER_PLAN_NOTE };
