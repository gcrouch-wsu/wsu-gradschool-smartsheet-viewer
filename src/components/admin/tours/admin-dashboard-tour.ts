import type { ProductTourStep } from "@/components/ui/ProductTour";

export const ADMIN_DASHBOARD_TOUR_STORAGE_KEY = "smartsheet-view:admin-dashboard-tour-seen";

export const ADMIN_DASHBOARD_TOUR_STEPS: ProductTourStep[] = [
  {
    id: "welcome",
    target: '[data-tour="ad-heading"]',
    title: "Workspace overview",
    body: "This dashboard summarizes sources, views, forms, and publishing. Open a list below when you need to configure something.",
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
    title: "Manage forms",
    body: "Open Form administration to create, publish, and maintain public forms that write into Smartsheet.",
  },
];
