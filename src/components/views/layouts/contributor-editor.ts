import type { ContributorEditingClientConfig } from "@/lib/contributor-utils";

/** Whether the contributor row editor can open for this view session. */
export function canOpenContributorEditor(
  embed: boolean,
  contributorEmail?: string | null,
  editingConfig?: ContributorEditingClientConfig | null,
  adminUnrestrictedEditing?: boolean,
) {
  return !embed && Boolean(editingConfig && (contributorEmail || adminUnrestrictedEditing));
}
