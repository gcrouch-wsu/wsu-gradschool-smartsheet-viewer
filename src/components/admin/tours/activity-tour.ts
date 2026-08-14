import type { ProductTourStep } from "@/components/ui/ProductTour";

export const ACTIVITY_TOUR_STORAGE_KEY = "smartsheet-view:activity-tour-seen";

export const ACTIVITY_TOUR_STEPS: ProductTourStep[] = [
  {
    id: "welcome",
    target: '[data-tour="aa-heading"]',
    title: "Activity log",
    body: "Audit trail for registry changes, builder saves, publish actions, resends, and related admin work.",
  },
  {
    id: "filters",
    target: '[data-tour="aa-filters"]',
    title: "Filter events",
    body: "Narrow the log by actor id or resource type, then apply to refresh the table.",
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
