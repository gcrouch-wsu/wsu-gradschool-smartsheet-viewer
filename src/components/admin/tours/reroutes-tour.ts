import type { ProductTourStep } from "@/components/ui/ProductTour";

export const REROUTES_TOUR_STORAGE_KEY = "smartsheet-view:reroutes-tour-seen";

export const REROUTES_TOUR_STEPS: ProductTourStep[] = [
  {
    id: "welcome",
    target: '[data-tour="ar-heading"]',
    title: "Contact reroutes",
    body: "Review proposed changes to pending approver contacts. Smartsheet is not updated until you approve.",
  },
  {
    id: "search",
    target: '[data-tour="ar-search"]',
    title: "Search requests",
    body: "Filter by name, email, sheet, or stage when the queue is long.",
  },
  {
    id: "status",
    target: '[data-tour="ar-status"]',
    title: "Status filters",
    body: "Switch between pending, approved, rejected, or all requests.",
  },
  {
    id: "table",
    target: '[data-tour="ar-table"]',
    title: "Request details",
    body: "See who requested the change, which submission and stage, and the from → to contact values.",
  },
  {
    id: "actions",
    target: '[data-tour="ar-actions"]',
    title: "Approve or reject",
    body: "Approve updates Smartsheet and can notify the new approver. Reject leaves the sheet unchanged.",
  },
];
