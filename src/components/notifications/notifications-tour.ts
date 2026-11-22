import type { ProductTourStep } from "@/components/ui/ProductTour";

export const NOTIFICATIONS_TOUR_STORAGE_KEY = "smartsheet-view:notifications-tour-seen";

export const NOTIFICATIONS_TOUR_STEPS: ProductTourStep[] = [
  {
    id: "welcome",
    target: '[data-tour="an-heading"]',
    title: "Workflow notifications",
    body: "Alerts, update requests, and approval requests from sheet workflows land here. This is the inbox those workflows write to.",
  },
  {
    id: "filters",
    target: '[data-tour="an-filters"]',
    title: "All and unread",
    body: "All notifications keeps the history. Unread notifications shows only what you have not opened.",
  },
  {
    id: "list",
    target: '[data-tour="an-list"]',
    title: "Open the details",
    body: "View Details shows the message and any included fields. Approval requests can be approved or declined here. Open related row jumps back to the sheet row when a link was saved.",
  },
  {
    id: "mark",
    target: '[data-tour="an-mark"]',
    title: "Mark all as read",
    body: "Clears the unread state for every notification in this inbox. It does not delete them.",
  },
];
