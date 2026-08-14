import type { ProductTourStep } from "@/components/ui/ProductTour";

export const PUBLIC_VIEW_TOUR_STORAGE_KEY = "smartsheet-view:public-view-tour-seen";

export const PUBLIC_VIEW_TOUR_STEPS: ProductTourStep[] = [
  {
    id: "welcome",
    target: '[data-tour="pv-heading"]',
    title: "Live Smartsheet directory",
    body: "This public page shows live data from Smartsheet in a branded layout. Search, filter, and browse below.",
  },
  {
    id: "layouts",
    target: '[data-tour="pv-layouts"]',
    title: "Change the layout",
    body: "Switch between table, cards, list, and other presentations. Some views lock a fixed layout.",
  },
  {
    id: "views",
    target: '[data-tour="pv-view-tabs"]',
    title: "Switch published views",
    body: "When several views share this URL, use these tabs to move between them.",
  },
  {
    id: "actions",
    target: '[data-tour="pv-actions"]',
    title: "Sign in, print, export",
    body: "Contributor sign in unlocks editing for your rows. Print and Export CSV are available for everyone.",
  },
  {
    id: "search",
    target: '[data-tour="pv-search"]',
    title: "Search the directory",
    body: "Filter by names, emails, programs, or other field text shown on this page.",
  },
  {
    id: "campus",
    target: '[data-tour="pv-campus"]',
    title: "Filter by campus",
    body: "Use campus chips when this view groups programs by campus.",
  },
  {
    id: "index",
    target: '[data-tour="pv-alpha-index"]',
    title: "Jump by letter",
    body: "The A–Z index scrolls to the first matching listing for that letter.",
  },
  {
    id: "results",
    target: '[data-tour="pv-results"]',
    title: "Browse results",
    body: "Open listings here. After contributor sign-in, Edit appears on rows you can update.",
  },
];
