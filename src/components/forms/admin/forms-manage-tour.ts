import type { ProductTourStep } from "@/components/ui/ProductTour";

export const FORMS_MANAGE_TOUR_STORAGE_KEY = "smartsheet-view:forms-manage-tour-seen";

export const FORMS_MANAGE_TOUR_STEPS: ProductTourStep[] = [
  {
    id: "welcome",
    target: '[data-tour="fm-heading"]',
    title: "Form administration",
    body: "Create, publish, and manage public forms that write into Smartsheet. Use Builder and Sheet for layout and approvals.",
  },
  {
    id: "create",
    target: '[data-tour="fm-create"]',
    title: "Create a form",
    body: "Start from a template, scratch, or Excel upload. New forms appear here before you publish a public /f/… URL.",
  },
  {
    id: "metrics",
    target: '[data-tour="fm-metrics"]',
    title: "Registry at a glance",
    body: "See how many forms are registered and which sheet is active for the workspace.",
  },
  {
    id: "search",
    target: '[data-tour="fm-search"]',
    title: "Filter the list",
    body: "Search by form name to find the sheet you need to edit, publish, or open.",
  },
  {
    id: "table",
    target: '[data-tour="fm-table"]',
    title: "Manage each form",
    body: "Set the active sheet, open Builder, jump to the approval grid, publish, or duplicate.",
  },
  {
    id: "add-sheet",
    target: '[data-tour="fm-add-sheet"]',
    title: "Import an existing sheet",
    body: "Add a Smartsheet that already exists into the forms registry without recreating it.",
  },
  {
    id: "webhooks",
    target: '[data-tour="fm-webhooks-tab"]',
    title: "Live update webhooks",
    body: "Open the Webhooks tab to register Smartsheet callbacks so the sheet grid stays current.",
  },
];
