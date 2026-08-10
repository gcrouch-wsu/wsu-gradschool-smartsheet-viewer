/**
 * Student portal discovery + row ownership against allowlisted Admin Sources.
 */

import { listSourceConfigs } from "@/lib/config/store";
import type { SourceConfig } from "@/lib/config/types";
import { normalizeContributorEmail } from "@/lib/contributor-utils";
import { isFieldFormItem } from "@/lib/forms/form-field-config";
import { loadFormFields } from "@/lib/forms/store/field-config";
import { normalizeFormSlug, slugFromFormName } from "@/lib/forms/slug";
import * as ss from "@/lib/forms/smartsheet-api";

export type FormsSheetColumn = { id: number; title?: string; type?: string };
export type FormsSheetCell = {
  columnId: number;
  value?: unknown;
  displayValue?: unknown;
  /** Smartsheet returns CONTACT_LIST values here rather than in `value`. */
  objectValue?: unknown;
};
export type FormsSheetRow = { id: number; cells?: FormsSheetCell[]; createdAt?: string };

export interface StudentAllowlistedSource {
  source: SourceConfig;
  sheetId: string;
  name: string;
  slug: string;
}

export function isStudentAllowlistedSource(source: SourceConfig): boolean {
  if (source.sourceType !== "sheet") return false;
  const formsEnabled = source.formsEnabled !== false;
  return formsEnabled || source.studentVisible === true;
}

export async function listStudentAllowlistedSources(): Promise<StudentAllowlistedSource[]> {
  const sources = await listSourceConfigs();
  return sources.filter(isStudentAllowlistedSource).map((source) => {
    const sheetId = String(source.smartsheetId);
    const slug =
      normalizeFormSlug(source.formSlug?.trim() || "") || slugFromFormName(source.label, sheetId);
    return {
      source,
      sheetId,
      name: source.label,
      slug,
    };
  });
}

function extractEmailsFromCell(cell: FormsSheetCell | undefined): string[] {
  if (!cell) return [];
  const emails = new Set<string>();
  const push = (raw: string) => {
    for (const match of raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []) {
      emails.add(normalizeContributorEmail(match));
    }
  };

  const visit = (value: unknown) => {
    if (typeof value === "string") {
      push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry);
      return;
    }
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      // CONTACT_LIST object values vary by API version (e.g. `values`,
      // `contacts`, or individual `{ email }` items), so traverse the
      // JSON payload rather than relying on one shape.
      for (const nestedValue of Object.values(obj)) visit(nestedValue);
    }
  };

  visit(cell.value);
  visit(cell.objectValue);
  visit(cell.displayValue);

  return [...emails];
}

/**
 * Resolve Student Email column ids for a source.
 * Prefer configured ids; else title "Student Email"; else kindHint email field; never first generic /e-?mail/i.
 */
export async function resolveStudentEmailColumnIds(
  source: SourceConfig,
  columns: FormsSheetColumn[],
): Promise<number[]> {
  const byId = new Map(columns.map((c) => [c.id, c]));
  const configured = (source.studentEmailColumnIds ?? []).filter((id) => byId.has(id));
  if (configured.length > 0) return configured;

  const studentEmailTitle = columns.find((c) => {
    const title = String(c.title ?? "").trim();
    return /\bstudent\b/i.test(title) && /\be-?mail\b/i.test(title);
  });
  if (studentEmailTitle) return [studentEmailTitle.id];

  try {
    const fieldConfig = await loadFormFields(String(source.smartsheetId));
    const emailField = fieldConfig?.fields?.find(
      (f) => isFieldFormItem(f) && f.kindHint === "email" && !f.hiddenOnForm,
    );
    if (emailField?.columnTitle) {
      const match = columns.find(
        (c) => String(c.title ?? "").trim().toLowerCase() === emailField.columnTitle.trim().toLowerCase(),
      );
      if (match) return [match.id];
    }
  } catch {
    // Field config optional for discovery.
  }

  return [];
}

export function rowHasStudentEmail(
  row: FormsSheetRow,
  email: string,
  studentEmailColumnIds: number[],
): boolean {
  const normalized = normalizeContributorEmail(email);
  if (!normalized || studentEmailColumnIds.length === 0) return false;
  const cells = row.cells ?? [];
  for (const columnId of studentEmailColumnIds) {
    const cell = cells.find((c) => c.columnId === columnId);
    if (extractEmailsFromCell(cell).includes(normalized)) return true;
  }
  return false;
}

export function filterOwnedRows(
  rows: FormsSheetRow[],
  email: string,
  studentEmailColumnIds: number[],
): FormsSheetRow[] {
  return rows.filter((row) => rowHasStudentEmail(row, email, studentEmailColumnIds));
}

export async function getAllowlistedSourceBySheetId(
  sheetId: string,
): Promise<StudentAllowlistedSource | null> {
  const list = await listStudentAllowlistedSources();
  return list.find((entry) => entry.sheetId === String(sheetId)) ?? null;
}

export interface StudentSheetMembership {
  sheetId: string;
  name: string;
  slug: string;
  sourceConfigId: string;
  ownedRowCount: number;
  studentEmailColumnIds: number[];
}

/** Load one sheet and return owned-row membership, or null if not matchable / no owned rows. */
export async function loadStudentSheetMembership(
  entry: StudentAllowlistedSource,
  email: string,
): Promise<StudentSheetMembership | null> {
  const sheet = await ss.getSheet(entry.sheetId);
  const columns = (sheet.columns ?? []) as FormsSheetColumn[];
  const studentEmailColumnIds = await resolveStudentEmailColumnIds(entry.source, columns);
  if (studentEmailColumnIds.length === 0) return null;

  const rows = (Array.isArray(sheet.rows) ? sheet.rows : []) as FormsSheetRow[];
  const owned = filterOwnedRows(rows, email, studentEmailColumnIds);
  if (owned.length === 0) return null;

  return {
    sheetId: entry.sheetId,
    name: typeof sheet.name === "string" && sheet.name.trim() ? sheet.name : entry.name,
    slug: entry.slug,
    sourceConfigId: entry.source.id,
    ownedRowCount: owned.length,
    studentEmailColumnIds,
  };
}

/** True when the email appears as Student Email on at least one allowlisted source. */
export async function isStudentEligibleAnywhere(email: string): Promise<boolean> {
  const normalized = normalizeContributorEmail(email);
  if (!normalized) return false;
  const sources = await listStudentAllowlistedSources();
  for (const entry of sources) {
    try {
      const membership = await loadStudentSheetMembership(entry, normalized);
      if (membership) return true;
    } catch {
      // Skip sheets that fail to load.
    }
  }
  return false;
}

/** All Student Email addresses currently present on allowlisted sources (for admin labeling). */
export async function collectStudentEmailsAnywhere(): Promise<Set<string>> {
  const emails = new Set<string>();
  const sources = await listStudentAllowlistedSources();
  await Promise.all(
    sources.map(async (entry) => {
      try {
        const sheet = await ss.getSheet(entry.sheetId);
        const columns = (sheet.columns ?? []) as FormsSheetColumn[];
        const studentEmailColumnIds = await resolveStudentEmailColumnIds(entry.source, columns);
        if (studentEmailColumnIds.length === 0) return;

        const rows = (Array.isArray(sheet.rows) ? sheet.rows : []) as FormsSheetRow[];
        for (const row of rows) {
          const cells = row.cells ?? [];
          for (const columnId of studentEmailColumnIds) {
            const cell = cells.find((c) => c.columnId === columnId);
            for (const email of extractEmailsFromCell(cell)) {
              emails.add(email);
            }
          }
        }
      } catch {
        // Skip sheets that fail to load.
      }
    }),
  );
  return emails;
}

export async function discoverStudentSheets(email: string): Promise<StudentSheetMembership[]> {
  const normalized = normalizeContributorEmail(email);
  const sources = await listStudentAllowlistedSources();
  const results: StudentSheetMembership[] = [];
  await Promise.all(
    sources.map(async (entry) => {
      try {
        const membership = await loadStudentSheetMembership(entry, normalized);
        if (membership) results.push(membership);
      } catch {
        // Skip failed sheets.
      }
    }),
  );
  results.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return results;
}
