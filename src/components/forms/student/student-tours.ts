import type { ProductTourStep } from "@/components/ui/ProductTour";

export const STUDENT_MY_SHEETS_TOUR_STORAGE_KEY = "smartsheet-view:student-my-sheets-tour-seen";

export const STUDENT_MY_SHEETS_TOUR_STEPS: ProductTourStep[] = [
  {
    id: "welcome",
    target: '[data-tour="sm-heading"]',
    title: "Your submission sheets",
    body: "These are Smartsheet forms where your student email appears. Open a sheet to track your submissions.",
  },
  {
    id: "search",
    target: '[data-tour="sm-search"]',
    title: "Search sheets",
    body: "Filter the list when you have access to many forms.",
  },
  {
    id: "table",
    target: '[data-tour="sm-table"]',
    title: "Sheet list",
    body: "Each row shows the form name and how many of your submissions are on that sheet.",
  },
  {
    id: "open",
    target: '[data-tour="sm-open"]',
    title: "Open a sheet",
    body: "Click Open to see your submissions and their approval status.",
  },
];

export const STUDENT_SHEET_TOUR_STORAGE_KEY = "smartsheet-view:student-sheet-tour-seen";

export const STUDENT_SHEET_TOUR_STEPS: ProductTourStep[] = [
  {
    id: "welcome",
    target: '[data-tour="ss-heading"]',
    title: "Your submissions",
    body: "Rows on this sheet that belong to your student email, with current approval status.",
  },
  {
    id: "search",
    target: '[data-tour="ss-search"]',
    title: "Search submissions",
    body: "Filter by label or status text.",
  },
  {
    id: "table",
    target: '[data-tour="ss-table"]',
    title: "Submission list",
    body: "Review status and open a row for field details, PDF, or contact reroute requests.",
  },
  {
    id: "view",
    target: '[data-tour="ss-view"]',
    title: "View details",
    body: "Open a submission to see answers, history, and request an approver contact change if needed.",
  },
];

export type StudentDetailTourTab = "details" | "reroute" | "history";

export type StudentDetailTourStep = ProductTourStep & {
  tab?: StudentDetailTourTab;
};

export const STUDENT_DETAIL_TOUR_STORAGE_KEY = "smartsheet-view:student-detail-tour-seen";

export const STUDENT_DETAIL_TOUR_STEPS: StudentDetailTourStep[] = [
  {
    id: "welcome",
    target: '[data-tour="sd-heading"]',
    title: "Submission detail",
    body: "Review what you submitted and track approval progress for this row.",
  },
  {
    id: "tabs",
    target: '[data-tour="sd-tabs"]',
    title: "Details, reroute, history",
    body: "Switch tabs for field values, contact change requests, and past decisions.",
  },
  {
    id: "fields",
    tab: "details",
    target: '[data-tour="sd-details"]',
    title: "Submitted fields",
    body: "Your answers as stored on the Smartsheet row.",
  },
  {
    id: "pdf",
    tab: "details",
    target: '[data-tour="sd-pdf"]',
    title: "PDF preview",
    body: "Open a generated or attached PDF when one is available for this submission.",
  },
  {
    id: "reroute",
    tab: "reroute",
    target: '[data-tour="sd-reroute"]',
    title: "Request a contact change",
    body: "Propose a new approver contact for Programs Team review when a stage needs updating.",
  },
  {
    id: "history",
    tab: "history",
    target: '[data-tour="sd-history"]',
    title: "Request history",
    body: "See pending, approved, and rejected contact-change requests for this submission.",
  },
];
