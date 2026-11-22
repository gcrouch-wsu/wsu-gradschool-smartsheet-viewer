import type { ProductTourStep } from "@/components/ui/ProductTour";

export const ACTIVITY_TOUR_STORAGE_KEY = "smartsheet-view:activity-tour-seen-v2";

export const ACTIVITY_TOUR_STEPS: ProductTourStep[] = [
  {
    id: "welcome",
    target: '[data-tour="aa-heading"]',
    title: "Activity",
    body: "Three records live here: the audit trail, Amazon SES email delivery, and workflow runs that failed.",
  },
  {
    id: "sections",
    target: '[data-tour="aa-sections"]',
    title: "Switch the record",
    body: "Audit trail is staff activity. Email delivery is sends, bounces, complaints, and the other SES events. Failed runs lists workflow errors and the next retry.",
  },
  {
    id: "email",
    target: '[data-tour="aa-tab-email"]',
    title: "Email delivery",
    body: "Filter by event type or search the recipient. Open a row for the SES detail. The webhook address for this environment is shown on that tab.",
  },
  {
    id: "runs",
    target: '[data-tour="aa-tab-runs"]',
    title: "Failed workflow runs",
    body: "A failed workflow stays here and retries after 60 seconds, up to three attempts. Open workflow jumps back to that sheet’s workflow.",
  },
  {
    id: "filters",
    target: '[data-tour="aa-filters"]',
    title: "Filter the audit trail",
    body: "On Audit trail, narrow the log by actor id or resource type, then apply to refresh the table.",
  },
  {
    id: "actor",
    target: '[data-tour="aa-actor"]',
    title: "Actor filter",
    body: "Enter an actor id to see only that person’s actions.",
  },
  {
    id: "resource",
    target: '[data-tour="aa-resource"]',
    title: "Resource type filter",
    body: "Filter by resource type such as view, source, or form to focus the trail.",
  },
  {
    id: "table",
    target: '[data-tour="aa-table"]',
    title: "Event list",
    body: "Each row shows when it happened, who did it, the action, and the resource involved.",
  },
];
