import type { ProductTourStep } from "@/components/ui/ProductTour";

export const FORMS_SEARCH_TOUR_STORAGE_KEY = "smartsheet-view:forms-search-tour-seen";

export const FORMS_SEARCH_TOUR_STEPS: ProductTourStep[] = [
  {
    id: "welcome",
    target: '[data-tour="fse-heading"]',
    title: "Workspace search",
    body: "Find submissions and sheets across your Smartsheet account from the Forms workspace.",
  },
  {
    id: "query",
    target: '[data-tour="fse-query"]',
    title: "Current query",
    body: "The heading shows the active search term from the URL (?q=).",
  },
  {
    id: "results",
    target: '[data-tour="fse-results"]',
    title: "Matches",
    body: "Results list object type, match text, and parent context when available.",
  },
];
