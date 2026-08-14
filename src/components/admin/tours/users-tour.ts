import type { ProductTourStep } from "@/components/ui/ProductTour";

export const USERS_TOUR_STORAGE_KEY = "smartsheet-view:users-tour-seen";

export const USERS_TOUR_STEPS: ProductTourStep[] = [
  {
    id: "welcome",
    target: '[data-tour="au-heading"]',
    title: "Staff users",
    body: "Invite Admins, Programs Team, and Coordinators. Everyone signs in at /admin/sign-in.",
  },
  {
    id: "bootstrap",
    target: '[data-tour="au-bootstrap"]',
    title: "Bootstrap owner",
    body: "The environment break-glass account is shown here for reference. Credentials stay in env vars.",
  },
  {
    id: "search",
    target: '[data-tour="au-search"]',
    title: "Search users",
    body: "Filter the managed user list by name or email.",
  },
  {
    id: "add",
    target: '[data-tour="au-add"]',
    title: "Add a user",
    body: "Invite someone by email and role. They set a password on first sign-in.",
  },
  {
    id: "table",
    target: '[data-tour="au-table"]',
    title: "Manage accounts",
    body: "Edit role and status, generate a reset link, or delete a managed user from the row actions menu.",
  },
];
