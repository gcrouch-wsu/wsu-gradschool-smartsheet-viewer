import type { ProductTourStep } from "@/components/ui/ProductTour";

export const CONTRIBUTORS_TOUR_STORAGE_KEY = "smartsheet-view:contributors-tour-seen";

export const CONTRIBUTORS_TOUR_STEPS: ProductTourStep[] = [
  {
    id: "welcome",
    target: '[data-tour="ac-heading"]',
    title: "Contributor accounts",
    body: "Password accounts for contributor editing on published views. Separate from student portal accounts.",
  },
  {
    id: "search",
    target: '[data-tour="ac-search"]',
    title: "Find an account",
    body: "Search by email to locate a contributor when you need a reset link or removal.",
  },
  {
    id: "count",
    target: '[data-tour="ac-count"]',
    title: "Account count",
    body: "See how many accounts match the current filter.",
  },
  {
    id: "table",
    target: '[data-tour="ac-table"]',
    title: "Account list",
    body: "Review emails and timestamps. Accounts appear when contributors complete first-time access.",
  },
  {
    id: "actions",
    target: '[data-tour="ac-actions"]',
    title: "Reset or remove",
    body: "Generate a one-time reset link to send, or remove an account that should no longer sign in.",
  },
];
