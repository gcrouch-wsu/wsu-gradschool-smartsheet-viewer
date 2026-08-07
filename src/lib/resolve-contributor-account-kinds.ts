import { getSourceConfigById, listViewConfigs } from "@/lib/config/store";
import {
  classifyContributorAccountKind,
  type ContributorAccountKind,
} from "@/lib/contributor-account-kinds";
import {
  collectContributorEmailsForRow,
  normalizeContributorEmail,
} from "@/lib/contributor-utils";
import { collectStudentEmailsAnywhere } from "@/lib/forms/student-access";
import { getSmartsheetDataset } from "@/lib/smartsheet";

/** Emails that appear in contact columns on any view with contributor editing enabled. */
export async function collectContributorEmailsAnywhere(): Promise<Set<string>> {
  const emails = new Set<string>();
  const views = await listViewConfigs();
  const contactColumnsBySource = new Map<string, Set<number>>();

  for (const view of views) {
    const editing = view.editing;
    if (!editing?.enabled || editing.contactColumnIds.length === 0) continue;
    const columnIds = contactColumnsBySource.get(view.sourceId) ?? new Set<number>();
    for (const columnId of editing.contactColumnIds) {
      columnIds.add(columnId);
    }
    contactColumnsBySource.set(view.sourceId, columnIds);
  }

  await Promise.all(
    [...contactColumnsBySource.entries()].map(async ([sourceId, columnIds]) => {
      try {
        const source = await getSourceConfigById(sourceId);
        if (!source) return;
        const dataset = await getSmartsheetDataset(source);
        const contactColumnIds = [...columnIds];
        for (const row of dataset.rows) {
          for (const email of collectContributorEmailsForRow(row, contactColumnIds)) {
            emails.add(email);
          }
        }
      } catch {
        // Skip sources that fail to load.
      }
    }),
  );

  return emails;
}

export async function resolveContributorAccountKinds(
  emails: string[],
): Promise<Map<string, ContributorAccountKind>> {
  const [studentEmails, contributorEmails] = await Promise.all([
    collectStudentEmailsAnywhere(),
    collectContributorEmailsAnywhere(),
  ]);

  const kinds = new Map<string, ContributorAccountKind>();
  for (const email of emails) {
    const normalized = normalizeContributorEmail(email);
    kinds.set(normalized, classifyContributorAccountKind(normalized, studentEmails, contributorEmails));
  }
  return kinds;
}
