import type { ProductTourStep } from "@/components/ui/ProductTour";

export const WORKFLOWS_TOUR_STORAGE_KEY = "smartsheet-view:workflows-tour-seen";

export const WORKFLOWS_TOUR_STEPS: ProductTourStep[] = [
  {
    id: "welcome",
    target: '[data-tour="ww-heading"]',
    title: "Workflows for this sheet",
    body: "Saved workflows lead this page. They watch the sheet and can notify people, request an update or approval, or change rows. Nothing runs until you save and enable it.",
  },
  {
    id: "new",
    target: '[data-tour="ww-new"]',
    title: "Start from a template",
    body: "New workflow opens a compact chooser. Pick a category, then Use. The template opens in the editor as a draft.",
  },
  {
    id: "list",
    target: '[data-tour="ww-list"]',
    title: "Workflows on this sheet",
    body: "Each row shows the name, template, and a status of Enabled, Draft, or Failed. Open a row for the Trigger, Conditions, Action, and Review rail. Send preview posts a sample alert. Runs stays in a scrolling list so a long history does not stretch the page.",
  },
  {
    id: "editor",
    target: '[data-tour="ww-editor"]',
    title: "Step rail",
    body: "The editor walks through Trigger, Conditions, Action, and Review. Any step can be opened from the rail. Save draft keeps it off. Save and enable turns it on. A failed run retries after 60 seconds.",
  },
];
