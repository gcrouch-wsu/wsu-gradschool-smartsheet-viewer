import type { ProductTourStep } from "@/components/ui/ProductTour";

export const SOURCE_FORM_TOUR_STORAGE_KEY = "smartsheet-view:source-form-tour-seen";

export const SOURCE_FORM_TOUR_STEPS: ProductTourStep[] = [
  {
    id: "welcome",
    target: '[data-tour="asf-heading"]',
    title: "Source editor",
    body: "Configure the data source once, then point one or more views (and Forms) at it. With Smartsheet off, this uses sheets stored in the app database.",
  },
  {
    id: "identity",
    target: '[data-tour="asf-identity"]',
    title: "Identity and data source",
    body: "Set the source ID and label, choose sheet or report, then pick the linked sheet (local catalog when Smartsheet is off).",
  },
  {
    id: "fetch",
    target: '[data-tour="asf-fetch"]',
    title: "Fetch Schema",
    body: "Load columns from the linked sheet. Schema is required before role-group mapping and student email columns.",
  },
  {
    id: "schema",
    target: '[data-tour="asf-schema"]',
    title: "Schema preview",
    body: "Confirm column titles and types, then merge detected role groups when numbered contact columns are present.",
  },
  {
    id: "roles",
    target: '[data-tour="asf-roles"]',
    title: "Role groups",
    body: "Map person slots (name, email, phone) used by contributor editing and approval contacts on views.",
  },
  {
    id: "save",
    target: '[data-tour="asf-save"]',
    title: "Save Source",
    body: "Persist the configuration. Views and Forms pick up the saved source on the next load.",
  },
];
