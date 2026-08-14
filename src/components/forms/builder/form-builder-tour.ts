import type { ProductTourStep } from "@/components/ui/ProductTour";

export const FORM_BUILDER_TOUR_STORAGE_KEY = "smartsheet-view:form-builder-tour-seen";

export type FormBuilderTourMode = "edit" | "preview" | "pdf";
export type FormBuilderTourRail = "add" | "field";

export type FormBuilderTourStep = ProductTourStep & {
  /** Switch builder mode before highlighting. */
  mode?: FormBuilderTourMode;
  /** Expand Form settings accordion (edit mode). */
  openSettings?: boolean;
  /** Expand Conditional logic accordion (edit mode). */
  openRules?: boolean;
  /** Select Add vs Field rail tab (edit mode). */
  railTab?: FormBuilderTourRail;
};

export const FORM_BUILDER_TOUR_STEPS: FormBuilderTourStep[] = [
  {
    id: "welcome",
    target: '[data-tour="fb-heading"]',
    title: "Build the public form",
    body: "This builder shapes the fields people see on /f/{slug}. Arrange the layout, preview it, map a PDF, then save.",
  },
  {
    id: "modes",
    target: '[data-tour="fb-modes"]',
    title: "Edit, Preview, and PDF",
    body: "Edit configures fields and rules. Preview shows the live public form. PDF maps fields onto the fillable PDF attached on submit.",
  },
  {
    id: "settings",
    mode: "edit",
    openSettings: true,
    target: '[data-tour="fb-settings"]',
    title: "Form settings",
    body: "Set logo, title, description, allowed email domains, and attachments. Draft forms get a public URL after you publish from Manage.",
  },
  {
    id: "palette",
    mode: "edit",
    railTab: "add",
    target: '[data-tour="fb-rail"]',
    title: "Add fields and layout",
    body: "Use the Add tab to drop short text, dropdowns, contacts, headings, and more onto the form. Select a field to edit it in the Field tab.",
  },
  {
    id: "canvas",
    mode: "edit",
    target: '[data-tour="fb-canvas"]',
    title: "Arrange the canvas",
    body: "Click a field to inspect it. Drag to reorder. Hide workflow-only columns so they stay on Smartsheet but off the public form.",
  },
  {
    id: "rules",
    mode: "edit",
    openRules: true,
    target: '[data-tour="fb-rules"]',
    title: "Conditional logic",
    body: "Add rules to show fields only when another field matches a value—useful for optional follow-ups.",
  },
  {
    id: "preview",
    mode: "preview",
    target: '[data-tour="fb-preview"]',
    title: "Preview the public form",
    body: "Switch to Preview to see how submitters experience the form before you publish changes.",
  },
  {
    id: "pdf",
    mode: "pdf",
    target: '[data-tour="fb-pdf"]',
    title: "PDF mapping",
    body: "Map form answers onto a PDF layout, tune theme and density, and preview the generated file. Settings here save separately from the field layout.",
  },
  {
    id: "save",
    mode: "edit",
    target: '[data-tour="fb-save"]',
    title: "Save the layout",
    body: "Click Save layout to persist field order, labels, settings, and conditional rules. Publish from Manage when the public form should go live.",
  },
];
