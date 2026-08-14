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
    id: "shell",
    target: '[data-tour="fse-shell-search"]',
    title: "Search from the header",
    body: "Type a query in the shell search box and press Enter. Results open on this page with ?q=.",
  },
  {
    id: "query",
    target: '[data-tour="fse-query"]',
    title: "Current query",
    body: "The heading shows the active search term from the URL.",
  },
  {
    id: "results",
    target: '[data-tour="fse-results"]',
    title: "Matches",
    body: "Results list object type, match text, and parent context when available.",
  },
  {
    id: "retry",
    target: '[data-tour="fse-shell-search"]',
    title: "Refine and search again",
    body: "Update the header search to run a new query without leaving the Forms workspace.",
  },
];
