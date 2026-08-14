import type { ProductTourStep } from "@/components/ui/ProductTour";

export const FORMS_SHEET_TOUR_STORAGE_KEY = "smartsheet-view:forms-sheet-tour-seen";

export const FORMS_SHEET_TOUR_STEPS: ProductTourStep[] = [
  {
    id: "welcome",
    target: '[data-tour="fs-heading"]',
    title: "Approval sheet grid",
    body: "This is the live Smartsheet grid for form submissions. Track approval status, search rows, and open a submission for details.",
  },
  {
    id: "picker",
    target: '[data-tour="fs-picker"]',
    title: "Switch form sheets",
    body: "Search and pick which registered form sheet to work on. The URL updates with ?sheetId= so you can share a deep link.",
  },
  {
    id: "refresh",
    target: '[data-tour="fs-refresh"]',
    title: "Refresh live data",
    body: "Reload the grid from Smartsheet. The page also refreshes automatically when a webhook reports sheet changes.",
  },
  {
    id: "status",
    target: '[data-tour="fs-status"]',
    title: "Filter by status",
    body: "Click Total, In review, Complete, or Declined to show only matching submissions. Choose Total again to clear the status filter.",
  },
  {
    id: "search",
    target: '[data-tour="fs-search"]',
    title: "Search the grid",
    body: "Type to filter by cell values, row id, or approval label. Combine with status filters as needed.",
  },
  {
    id: "columns",
    target: '[data-tour="fs-columns"]',
    title: "Show form or approval columns",
    body: "All columns shows everything. Form focuses on submission fields. Approval focuses on stage, overall, and resend columns.",
  },
  {
    id: "highlight",
    target: '[data-tour="fs-highlight"]',
    title: "Color-code approvals",
    body: "When enabled, approval cells tint green (approved), red (declined), or amber (in progress). Use the legend above the table.",
  },
  {
    id: "grid",
    target: '[data-tour="fs-grid"]',
    title: "Open a submission",
    body: "Click any row to open the submission detail modal—timeline, attachments, discussions, resend, and reroute when available. Resend buttons in the grid re-trigger approval emails without leaving the table.",
  },
];
