import type { ProductTourStep } from "@/components/ui/ProductTour";

export const SOURCES_LIST_TOUR_STORAGE_KEY = "smartsheet-view:sources-list-tour-seen";

export const SOURCES_LIST_TOUR_STEPS: ProductTourStep[] = [
  {
    id: "welcome",
    target: '[data-tour="as-heading"]',
    title: "Sources catalog",
    body: "Sources are shared Smartsheet sheets or reports. Views and Forms both read from this catalog.",
  },
  {
    id: "new",
    target: '[data-tour="as-new"]',
    title: "Register a source",
    body: "Create a new source to connect a sheet or report, fetch its schema, and map role groups.",
  },
  {
    id: "table",
    target: '[data-tour="as-table"]',
    title: "Browse sources",
    body: "Each row shows connection details, how many views use it, and whether Forms can use the sheet.",
  },
  {
    id: "forms",
    target: '[data-tour="as-forms"]',
    title: "Use in Forms",
    body: "For sheet sources, open Forms from here to add the sheet to the forms registry without re-entering the ID.",
  },
  {
    id: "edit",
    target: '[data-tour="as-table"]',
    title: "Edit a source",
    body: "Click a source name to edit identity, schema, student visibility, and role-group mappings.",
  },
];
