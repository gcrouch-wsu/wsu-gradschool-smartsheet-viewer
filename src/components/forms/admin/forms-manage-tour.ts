import type { ProductTourStep } from "@/components/ui/ProductTour";

export const FORMS_MANAGE_TOUR_STORAGE_KEY = "smartsheet-view:forms-manage-tour-seen";

export const FORMS_MANAGE_TOUR_STEPS: ProductTourStep[] = [
  {
    id: "welcome",
    target: '[data-tour="fm-heading"]',
    title: "Webhooks",
    body: "Register Smartsheet callbacks so the sheet grid stays current. Form lists and publish live under Admin → Sources.",
  },
  {
    id: "webhooks",
    target: '[data-tour="fm-webhooks-tab"]',
    title: "Live update webhooks",
    body: "Create, enable, or delete webhooks for the active sheet. Open Sources to switch which form is active.",
  },
];
