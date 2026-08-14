import type { ProductTourStep } from "@/components/ui/ProductTour";

export const VIEWS_LIST_TOUR_STORAGE_KEY = "smartsheet-view:views-list-tour-seen";

export const VIEWS_LIST_TOUR_STEPS: ProductTourStep[] = [
  {
    id: "welcome",
    target: '[data-tour="av-heading"]',
    title: "Views list",
    body: "Views map source fields onto a public route. Preview before you publish.",
  },
  {
    id: "new",
    target: '[data-tour="av-new"]',
    title: "Create a view",
    body: "Start a new view definition. You will pick a source, layout, fields, and filters in the builder.",
  },
  {
    id: "table",
    target: '[data-tour="av-table"]',
    title: "Browse views",
    body: "Each row shows the source, public route, and draft vs published status.",
  },
  {
    id: "status",
    target: '[data-tour="av-status"]',
    title: "Status and preview",
    body: "See whether a view is live, then open Preview to check the page before publishing.",
  },
  {
    id: "edit",
    target: '[data-tour="av-table"]',
    title: "Open the builder",
    body: "Click a view name to edit layout, fields, filters, contributor editing, and publish settings.",
  },
];
