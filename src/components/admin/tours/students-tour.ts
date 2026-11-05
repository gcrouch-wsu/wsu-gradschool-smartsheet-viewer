import type { ProductTourStep } from "@/components/ui/ProductTour";

export const STUDENTS_TOUR_STORAGE_KEY = "smartsheet-view:students-tour-seen";

export const STUDENTS_TOUR_STEPS: ProductTourStep[] = [
  {
    id: "welcome",
    target: '[data-tour="ast-heading"]',
    title: "Student accounts",
    body: "Password accounts for the student portal (/student). Separate from contributor editing accounts.",
  },
  {
    id: "search",
    target: '[data-tour="ast-search"]',
    title: "Find a student",
    body: "Search by email when you need to help with a reset or remove access.",
  },
  {
    id: "count",
    target: '[data-tour="ast-count"]',
    title: "Account count",
    body: "See how many student accounts match the current filter.",
  },
  {
    id: "table",
    target: '[data-tour="ast-table"]',
    title: "Account list",
    body: "Accounts appear when students sign in at the student portal.",
  },
  {
    id: "actions",
    target: '[data-tour="ast-actions"]',
    title: "Reset or remove",
    body: "Generate a one-time reset link, or remove an account that should no longer sign in.",
  },
];
