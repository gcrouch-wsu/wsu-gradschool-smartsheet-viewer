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
    id: "signin",
    target: '[data-tour="pv-signin"]',
    title: "Contributor sign in",
    body: "This icon opens contributor sign-in. After you sign in, the edit icon appears on the rows you can update.",
  },
  {
    id: "account",
    target: '[data-tour="pv-account"]',
    title: "You're signed in",
    body: "Your name is in the header. The icons beside it are print, how to use, export, and contributor instructions. Log out is the last icon.",
  },
  {
    id: "print",
    target: '[data-tour="pv-print"]',
    title: "Print / PDF",
    body: "Print this view or save it as a PDF.",
  },
  {
    id: "export",
    target: '[data-tour="pv-export"]',
    title: "Export CSV",
    body: "Download the rows in this view as a CSV file.",
  },
  {
    id: "instructions",
    target: '[data-tour="pv-instructions"]',
    title: "Contributor instructions",
    body: "Open the contributor guide in a new window. It explains how to sign in and edit your rows.",
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
    body: "Open listings here. After contributor sign-in, the edit icon appears on rows you can update.",
  },
];
