/**
 * Classify emails by sheet membership (Student Email vs contributor contact columns).
 * Used for one-time account migration out of the shared contributor_users table.
 */

import { normalizeContributorEmail } from "@/lib/contributor-utils";

export type ContributorAccountKind = "student" | "contributor" | "both" | "none";

export function classifyContributorAccountKind(
  email: string,
  studentEmails: ReadonlySet<string>,
  contributorEmails: ReadonlySet<string>,
): ContributorAccountKind {
  const normalized = normalizeContributorEmail(email);
  if (!normalized) return "none";
  const isStudent = studentEmails.has(normalized);
  const isContributor = contributorEmails.has(normalized);
  if (isStudent && isContributor) return "both";
  if (isStudent) return "student";
  if (isContributor) return "contributor";
  return "none";
}

export function labelForContributorAccountKind(kind: ContributorAccountKind): string {
  switch (kind) {
    case "student":
      return "Student";
    case "contributor":
      return "Contributor";
    case "both":
      return "Student & contributor";
    case "none":
      return "Not on sheet";
  }
}
