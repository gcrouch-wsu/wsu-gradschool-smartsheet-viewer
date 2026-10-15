import type { ProductTourStep } from "@/components/ui/ProductTour";

export const SOURCES_LIST_TOUR_STORAGE_KEY = "smartsheet-view:sources-list-tour-seen";

export const SOURCES_LIST_TOUR_STEPS: ProductTourStep[] = [
  {
    id: "welcome",
    target: '[data-tour="as-heading"]',
    title: "Sources catalog",
    body: "One catalog for views and forms. Register a sheet or report, then open sheet, builder, or views from the row.",
  },
  {
    id: "create",
    target: '[data-tour="as-create-form"]',
    title: "Create a form",
    body: "Clone a template, start from scratch, or import Excel. New sheets are registered here.",
  },
  {
    id: "new",
    target: '[data-tour="as-new"]',
    title: "Register a source",
    body: "Connect an existing Smartsheet sheet or report, fetch its schema, and map role groups.",
  },
  {
    id: "table",
    target: '[data-tour="as-table"]',
    title: "Browse sources",
    body: "Each row shows slug, views count, and publication status. Use the eye for sheet and the pencil for builder.",
  },
  {
    id: "edit",
    target: '[data-tour="as-table"]',
    title: "Edit a source",
    body: "Open a name for identity and schema, or use row actions for sheet, builder, publish, and duplicate.",
  },
];
