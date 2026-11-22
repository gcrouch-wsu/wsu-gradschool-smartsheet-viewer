import type { ProductTourStep } from "@/components/ui/ProductTour";

export const ADMIN_DASHBOARD_TOUR_STORAGE_KEY = "smartsheet-view:admin-dashboard-tour-seen-v2";

export const ADMIN_DASHBOARD_TOUR_STEPS: ProductTourStep[] = [
  {
    id: "welcome",
    target: '[data-tour="ad-heading"]',
    title: "Workspace overview",
    body: "This dashboard summarizes sources, views, forms, and publishing. Activity tracks email delivery and failed workflow runs. Notifications holds the alerts those workflows send.",
  },
  {
    id: "stats",
    target: '[data-tour="ad-stats"]',
    title: "Counts at a glance",
    body: "See how many sources and views exist, how many views are published, and how many forms are in the registry.",
  },
  {
    id: "sources",
    target: '[data-tour="ad-sources"]',
    title: "Recent sources",
    body: "Jump into a recently edited source, or open All sources to register a new Smartsheet connection.",
  },
  {
    id: "views",
    target: '[data-tour="ad-views"]',
    title: "Recent views",
    body: "Open a view to edit layout and fields, or go to All views to create and publish public pages.",
  },
  {
    id: "forms",
    target: '[data-tour="ad-forms"]',
    title: "Manage sources",
    body: "Open Sources to create forms, publish /f URLs, set the active workspace sheet, and configure views. A source sheet also opens Workflows.",
  },
  {
    id: "activity",
    target: '[data-tour="nav-activity"]',
    title: "Activity",
    body: "Audit trail is staff activity. Email delivery is Amazon SES. Failed runs lists workflow errors and the next retry.",
  },
  {
    id: "notifications",
    target: '[data-tour="nav-notifications"]',
    title: "Notifications",
    body: "The inbox for workflow alerts, update requests, and approvals. View Details opens the message. Approve or decline from there.",
  },
];
