import type { ProductTourStep } from "@/components/ui/ProductTour";
import type { ViewBuilderTab } from "./view-builder-utils";

export const VIEW_BUILDER_TOUR_STORAGE_KEY = "smartsheet-view:view-builder-tour-seen";

export type ViewBuilderTourStep = ProductTourStep & {
  /** Switch the builder to this tab before highlighting (omit for header/actions). */
  tab?: ViewBuilderTab;
};

export const VIEW_BUILDER_TOUR_STEPS: ViewBuilderTourStep[] = [
  {
    id: "welcome",
    target: '[data-tour="vb-heading"]',
    title: "Build a public Smartsheet page",
    body: "This View Builder turns live Smartsheet data into a branded public page. Walk through each tab, then save and publish when it looks right.",
  },
  {
    id: "setup-tab",
    tab: "setup",
    target: '[data-tour="vb-tab-setup"]',
    title: "Start on Setup",
    body: "Setup holds page identity, layout, branding, and publication settings. Open this tab first when configuring a view.",
  },
  {
    id: "layout-presets",
    tab: "setup",
    target: '[data-tour="vb-layout-presets"]',
    title: "Pick a layout preset",
    body: "Choose a starting layout—table, cards, accordion, and more. You can refine fields and filters on the later tabs.",
  },
  {
    id: "source-identity",
    tab: "setup",
    target: '[data-tour="vb-source-identity"]',
    title: "Connect source and slug",
    body: "Select the Smartsheet source, set the label, and choose the public URL slug. A view cannot publish without a valid source.",
  },
  {
    id: "fields-tab",
    tab: "fields",
    target: '[data-tour="vb-tab-fields"]',
    title: "Open the Fields tab",
    body: "Fields control which Smartsheet columns appear on the public page and how they are labeled.",
  },
  {
    id: "load-columns",
    tab: "fields",
    target: '[data-tour="vb-load-columns"]',
    title: "Load columns, then include them",
    body: "Click Load columns to fetch the sheet schema, then check each column you want in the view. Reorder or rename in Arrange.",
  },
  {
    id: "filters-tab",
    tab: "filters",
    target: '[data-tour="vb-tab-filters"]',
    title: "Open Filters & Sort",
    body: "Filters limit which rows the public sees. Use them to hide draft or deleted rows before publishing.",
  },
  {
    id: "add-filter",
    tab: "filters",
    target: '[data-tour="vb-add-filter"]',
    title: "Add a filter rule",
    body: "Click Add filter, pick a column, then set an operator and value. For a Public Visibility column, use “not in” with Hide, Delete.",
  },
  {
    id: "editing-tab",
    tab: "editing",
    target: '[data-tour="vb-tab-editing"]',
    title: "Optional contributor editing",
    body: "Enable row-level editing for people listed in contact columns. Skip this tab if the view is read-only.",
  },
  {
    id: "preview-tab",
    tab: "preview",
    target: '[data-tour="vb-tab-preview"]',
    title: "Preview before going live",
    body: "Check the page at full, tablet, and mobile widths. Fix anything that looks off before you publish.",
  },
  {
    id: "save",
    target: '[data-tour="vb-save"]',
    title: "Save the view",
    body: "Click Save View to persist your configuration. Saving does not make the page public yet.",
  },
  {
    id: "publish",
    target: '[data-tour="vb-publish"]',
    title: "Publish when ready",
    body: "Click Publish to make the page live at /view/{slug}. You can Unpublish later from the same button.",
  },
];
