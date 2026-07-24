import type { CSSProperties } from "react";
import { resolvedRowCampusBadgeLabels } from "@/lib/campus-grouping";
import {
  CARD_LAYOUT_CAMPUS_BADGES,
  CARD_LAYOUT_PLACEHOLDER,
  CARD_LAYOUT_TEXT_PREFIX,
  type CampusBadgePresentationStyle,
  type ResolvedFieldValue,
  type ResolvedView,
  type ResolvedViewRow,
} from "@/lib/config/types";
import {
  contributorResolvedFieldStub,
  type ContributorEditableFieldDefinition,
} from "@/lib/contributor-utils";

export type CardLayoutCell =
  | { type: "field"; field: ResolvedFieldValue }
  | { type: "placeholder" }
  | { type: "text"; label: string }
  | { type: "campus_badges"; campuses: string[]; style?: CampusBadgePresentationStyle };

/**
 * Merged display rows combine several Smartsheet lines (same program + shared contacts, or same program + campus).
 * Custom card layouts often repeat the program (and other) columns per visual block; after merge those values are
 * identical except campus. Collapse later occurrences to placeholders so view and contributor editor list each field once.
 */
function dedupeCardLayoutRowsForMergedRow(row: ResolvedViewRow, rows: CardLayoutCell[][]): CardLayoutCell[][] {
  if (!row.mergedSourceRowIds || row.mergedSourceRowIds.length < 2) {
    return rows;
  }
  const seenFieldKeys = new Set<string>();
  let seenCampusBadges = false;
  const next = rows.map((cells) =>
    cells.map((cell): CardLayoutCell => {
      if (cell.type === "field") {
        const k = cell.field.key;
        if (seenFieldKeys.has(k)) {
          return { type: "placeholder" };
        }
        seenFieldKeys.add(k);
        return cell;
      }
      if (cell.type === "campus_badges") {
        if (seenCampusBadges) {
          return { type: "placeholder" };
        }
        seenCampusBadges = true;
        return cell;
      }
      return cell;
    }),
  );
  return next.filter((cells) =>
    cells.some(
      (c) =>
        c.type === "field" ||
        c.type === "text" ||
        (c.type === "campus_badges" && c.campuses.length > 0),
    ),
  );
}

function fieldCanRender(field: ResolvedFieldValue) {
  return !(field.hideWhenEmpty && field.isEmpty);
}

/** Minimal resolved field for contributor edit ordering when a cell is empty or hidden on the public card. */
export function buildStubResolvedField(view: ResolvedView, key: string): ResolvedFieldValue | null {
  const meta = view.fields.find((f) => f.key === key);
  if (!meta) {
    return null;
  }
  const base: ResolvedFieldValue = {
    key: meta.key,
    label: meta.label,
    renderType: meta.renderType,
    textValue: "",
    listValue: [],
    links: [],
    isEmpty: true,
    hideWhenEmpty: false,
    hideLabel: false,
    textStyle: meta.textStyle,
    labelStyle: meta.labelStyle,
  };
  if (meta.renderType === "people_group") {
    base.people = [];
    base.listDisplay = "inline";
    base.peopleStyle = "plain";
  }
  return base;
}

function contributorStubForLayoutKey(
  view: ResolvedView,
  key: string,
  contributorFieldKeys: Set<string> | undefined,
  contributorEditableByKey: Map<string, ContributorEditableFieldDefinition> | undefined,
): ResolvedFieldValue | null {
  const fromResolvedMeta = buildStubResolvedField(view, key);
  if (fromResolvedMeta) {
    return fromResolvedMeta;
  }
  const ed = contributorEditableByKey?.get(key);
  if (ed) {
    return contributorResolvedFieldStub(ed);
  }
  if (!contributorFieldKeys?.has(key)) {
    return null;
  }
  return null;
}

export function describeResolvedField(field: ResolvedFieldValue) {
  if (field.renderType === "people_group" && field.people?.some((p) => !p.isEmpty)) {
    return field.people
      .filter((p) => !p.isEmpty)
      .map((p) => [p.name, p.email, p.phone].filter(Boolean).join(" "))
      .join("; ");
  }
  if (field.textValue) {
    return field.textValue;
  }
  if (field.links.length > 0) {
    return field.links.map((link) => link.label).join(", ");
  }
  if (field.listValue.length > 0) {
    return field.listValue.join(", ");
  }
  return "";
}

export function getVisibleRowFields(row: ResolvedViewRow, omittedKeys: string[] = []) {
  const omitted = new Set(omittedKeys.filter(Boolean));
  return row.fields.filter((field) => !omitted.has(field.key) && fieldCanRender(field));
}

export function getRowHeadingField(view: ResolvedView, row: ResolvedViewRow) {
  const preferred = view.presentation?.headingFieldKey ? row.fieldMap[view.presentation.headingFieldKey] : undefined;
  if (preferred && fieldCanRender(preferred)) {
    return preferred;
  }

  return row.fields.find((field) => fieldCanRender(field)) ?? row.fields[0] ?? null;
}

export function getRowSummaryField(view: ResolvedView, row: ResolvedViewRow, headingKey?: string) {
  const preferredKey = view.presentation?.summaryFieldKey;
  const preferred = preferredKey ? row.fieldMap[preferredKey] : undefined;
  if (preferred && preferred.key !== headingKey && fieldCanRender(preferred)) {
    return preferred;
  }

  return row.fields.find((field) => field.key !== headingKey && fieldCanRender(field)) ?? null;
}

export function getRowHeadingText(view: ResolvedView, row: ResolvedViewRow) {
  const heading = getRowHeadingField(view, row);
  const text = heading ? describeResolvedField(heading) : "";
  return text || `Row ${row.id}`;
}

/**
 * Human-friendly title for the contributor edit drawer. Uses the same heading field as list/cards;
 * does not use the raw Smartsheet row id as the visible label (that id stays in sr-only for support).
 */
export function getContributorEditRowHeading(view: ResolvedView, row: ResolvedViewRow) {
  const heading = getRowHeadingField(view, row);
  const text = heading ? describeResolvedField(heading).trim() : "";
  if (text) {
    return text;
  }
  return null;
}

/** Field used for A-Z index. Uses indexFieldKey if set, else headingFieldKey, else first field. */
export function getIndexField(view: ResolvedView, row: ResolvedViewRow) {
  const key = view.presentation?.indexFieldKey ?? view.presentation?.headingFieldKey;
  const preferred = key ? row.fieldMap[key] : undefined;
  if (preferred && fieldCanRender(preferred)) {
    return preferred;
  }
  return getRowHeadingField(view, row);
}

export function getIndexText(view: ResolvedView, row: ResolvedViewRow) {
  const field = getIndexField(view, row);
  const text = field ? describeResolvedField(field) : "";
  return text || `Row ${row.id}`;
}

/** When cardLayout is set, returns cells grouped by row. Each cell is field, placeholder, or static text. Skips rows with no fields. */
export function getCardLayoutRows(
  view: ResolvedView,
  row: ResolvedViewRow,
  options?: {
    contributorFieldKeys?: Set<string>;
    contributorEditableByKey?: Map<string, ContributorEditableFieldDefinition>;
  },
): CardLayoutCell[][] {
  const layout = view.presentation?.cardLayout;
  if (!layout || layout.length === 0) {
    return [];
  }
  const contrib = options?.contributorFieldKeys;
  const contribEditable = options?.contributorEditableByKey;
  const contribAllowsKey = (k: string) =>
    (contrib?.has(k) ?? false) || (contribEditable?.has(k) ?? false);

  const mapped = layout
    .map((layoutRow) =>
      layoutRow.fieldKeys.map((key): CardLayoutCell => {
        if (key === CARD_LAYOUT_PLACEHOLDER) {
          return { type: "placeholder" };
        }
        if (key.startsWith(CARD_LAYOUT_TEXT_PREFIX)) {
          return { type: "text", label: key.slice(CARD_LAYOUT_TEXT_PREFIX.length) };
        }
        if (key === CARD_LAYOUT_CAMPUS_BADGES) {
          const campuses = resolvedRowCampusBadgeLabels(row, view.presentation?.campusFieldKey);
          return {
            type: "campus_badges",
            campuses,
            style: view.presentation?.campusBadgeStyle,
          };
        }
        const campusKey = view.presentation?.campusFieldKey;
        if (
          campusKey &&
          key === campusKey &&
          view.presentation?.hideCampusFieldInRecordDisplay === true
        ) {
          // Public cards use a placeholder; contributor editor still needs the real field (or stub).
          if (contribAllowsKey(campusKey)) {
            const campusField = row.fieldMap[campusKey];
            if (campusField) {
              return { type: "field", field: campusField };
            }
            const stub = contributorStubForLayoutKey(view, campusKey, contrib, contribEditable);
            if (stub) {
              return { type: "field", field: stub };
            }
          }
          return { type: "placeholder" };
        }
        const statusSupKey = view.presentation?.recordSuppressedFileStatusFieldKey;
        if (
          statusSupKey &&
          key === statusSupKey &&
          row.recordSuppression &&
          view.presentation?.recordSuppressedFileHideStatusFieldInPublicBody !== false
        ) {
          if (contribAllowsKey(statusSupKey)) {
            const statusField = row.fieldMap[statusSupKey];
            if (statusField) {
              return { type: "field", field: statusField };
            }
            const stub = contributorStubForLayoutKey(view, statusSupKey, contrib, contribEditable);
            if (stub) {
              return { type: "field", field: stub };
            }
          }
          return { type: "placeholder" };
        }
        const field = row.fieldMap[key];
        if (field && (fieldCanRender(field) || contribAllowsKey(key))) {
          return { type: "field", field };
        }
        if (contribAllowsKey(key)) {
          const stub = contributorStubForLayoutKey(view, key, contrib, contribEditable);
          if (stub) {
            return { type: "field", field: stub };
          }
        }
        // Field absent or hidden: keep a placeholder so column positions stay aligned
        return { type: "placeholder" };
      })
    )
    .filter((cells) =>
      cells.some(
        (c) =>
          c.type === "field" ||
          c.type === "text" ||
          (c.type === "campus_badges" && c.campuses.length > 0),
      ),
    );
  return dedupeCardLayoutRowsForMergedRow(row, mapped);
}

/** Get first field from a row of cells (for accordion/tabbed summary). */
export function getFirstFieldFromCells(cells: CardLayoutCell[]): ResolvedFieldValue | null {
  const cell = cells.find((c) => c.type === "field");
  return cell?.type === "field" ? cell.field : null;
}

/**
 * Custom card layout: a row with exactly one field and a hidden label continues the previous block (e.g. email
 * under contact). Uses tight spacing instead of full row dividers (`mt-4 pt-4`, list `border-t pt-4`, etc.).
 */
export function cardLayoutContinuationRowClass(
  paddedCells: CardLayoutCell[],
  rowIndex: number,
  standardClass: string,
): string {
  if (rowIndex === 0) return standardClass;
  const fields = paddedCells.filter((c): c is Extract<CardLayoutCell, { type: "field" }> => c.type === "field");
  if (fields.length === 1 && fields[0].field.hideLabel) {
    return "mt-1 border-t-0 pt-0";
  }
  return standardClass;
}

/** Max number of columns across all card layout rows (for grid alignment). */
export function getCardLayoutColumnCount(view: ResolvedView): number {
  const layout = view.presentation?.cardLayout;
  if (!layout || layout.length === 0) return 0;
  return Math.max(...layout.map((row) => row.fieldKeys.length), 0);
}

/** Whether the view uses custom card layout. */
export function hasCustomCardLayout(view: ResolvedView): boolean {
  const layout = view.presentation?.cardLayout;
  return Boolean(layout && layout.length > 0);
}

/**
 * When true, merged campus chips are placed only via the `__campus_badges__` card-layout rows (in Arrange order).
 * Suppress the automatic `<MergedRowCampusBadges>` block above custom layout so badges are not duplicated on top.
 */
export function cardLayoutIncludesCampusBadges(view: ResolvedView): boolean {
  const layout = view.presentation?.cardLayout;
  if (!layout?.length) {
    return false;
  }
  return layout.some((row) => row.fieldKeys.includes(CARD_LAYOUT_CAMPUS_BADGES));
}

/** Common view field key when label is not matched (grad programs). */
const PUBLIC_VISIBILITY_FIELD_KEY = "public_visibility";

/**
 * Field backing the “Public Visibility” picklist: exact label match, or `public_visibility` key.
 */
export function resolvePublicVisibilityFieldKey(view: ResolvedView): string | undefined {
  const byLabel = view.fields.find(
    (f) => (f.label || "").trim().toLowerCase() === "public visibility",
  );
  if (byLabel) return byLabel.key;
  const byKey = view.fields.find((f) => f.key === PUBLIC_VISIBILITY_FIELD_KEY);
  return byKey?.key;
}

/**
 * Contributor **card** editor: campus (when configured) and Public Visibility go under “Additional fields”;
 * program, contacts, and everything else stay in the main editor.
 */
export function getContributorEditorAdditionalOnlyFieldKeys(view: ResolvedView): Set<string> {
  const keys = new Set<string>();
  const campus = view.presentation?.campusFieldKey;
  if (campus) keys.add(campus);
  const pub = resolvePublicVisibilityFieldKey(view);
  if (pub) keys.add(pub);
  return keys;
}

/** Remove campus / visibility cells from custom layout rows for the contributor main editor (placeholders keep column alignment). */
export function stripCardLayoutRowsForContributorMainEditor(
  rows: CardLayoutCell[][],
  additionalOnlyKeys: Set<string>,
  campusFieldKey: string | undefined,
): CardLayoutCell[][] {
  const suppressCampusBadges = Boolean(campusFieldKey && additionalOnlyKeys.has(campusFieldKey));
  const mapped = rows.map((cells) =>
    cells.map((cell): CardLayoutCell => {
      if (cell.type === "field" && additionalOnlyKeys.has(cell.field.key)) {
        return { type: "placeholder" };
      }
      if (cell.type === "campus_badges" && suppressCampusBadges) {
        return { type: "placeholder" };
      }
      return cell;
    }),
  );
  return mapped.filter((cells) =>
    cells.some(
      (c) =>
        c.type === "field" ||
        c.type === "text" ||
        (c.type === "campus_badges" && c.campuses.length > 0),
    ),
  );
}

export function sortContributorEditorAdditionalFields(
  fields: ResolvedFieldValue[],
  view: ResolvedView,
): ResolvedFieldValue[] {
  const campus = view.presentation?.campusFieldKey;
  const pub = resolvePublicVisibilityFieldKey(view);
  const rank = (key: string): number => {
    if (campus && key === campus) return 0;
    if (pub && key === pub) return 1;
    return 99;
  };
  return [...fields].sort((a, b) => rank(a.key) - rank(b.key));
}

/**
 * Field order for the contributor edit drawer: mirrors public card order (custom layout or heading/summary/body)
 * and keeps contributor-target fields even when the card would hide them as empty.
 */
export function getEditDrawerOrderedFields(
  view: ResolvedView,
  row: ResolvedViewRow,
  contributorFieldKeys: Set<string>,
  contributorEditableByKey?: Map<string, ContributorEditableFieldDefinition>,
): ResolvedFieldValue[] {
  const redactedKeys = new Set(row.recordSuppression?.redactedFieldKeys ?? []);
  const shouldShow = (field: ResolvedFieldValue) =>
    !redactedKeys.has(field.key) &&
    (contributorFieldKeys.has(field.key) ||
      contributorEditableByKey?.has(field.key) ||
      fieldCanRender(field));

  const appendMissingContributorFields = (ordered: ResolvedFieldValue[]) => {
    const seen = new Set(ordered.map((f) => f.key));
    const keysToAdd = new Set<string>(contributorFieldKeys);
    for (const k of contributorEditableByKey?.keys() ?? []) {
      keysToAdd.add(k);
    }
    for (const key of keysToAdd) {
      if (seen.has(key)) continue;
      if (redactedKeys.has(key)) continue;
      const field =
        row.fieldMap[key] ??
        contributorStubForLayoutKey(view, key, contributorFieldKeys, contributorEditableByKey);
      if (!field) continue;
      const adminMarkedEditable = contributorEditableByKey?.has(key) === true;
      if (adminMarkedEditable || shouldShow(field)) {
        ordered.push(field);
        seen.add(key);
      }
    }
    return ordered;
  };

  if (hasCustomCardLayout(view)) {
    const rows = getCardLayoutRows(view, row, { contributorFieldKeys, contributorEditableByKey });
    const out: ResolvedFieldValue[] = [];
    const seenKeys = new Set<string>();
    for (const cells of rows) {
      for (const cell of cells) {
        if (cell.type === "field" && shouldShow(cell.field)) {
          if (seenKeys.has(cell.field.key)) {
            continue;
          }
          seenKeys.add(cell.field.key);
          out.push(cell.field);
        }
      }
    }
    return appendMissingContributorFields(out);
  }

  const heading = getRowHeadingField(view, row);
  const summary = getRowSummaryField(view, row, heading?.key);
  const out: ResolvedFieldValue[] = [];
  if (heading && shouldShow(heading)) {
    out.push(heading);
  }
  if (summary && summary.key !== heading?.key && shouldShow(summary)) {
    out.push(summary);
  }
  for (const field of row.fields) {
    if (field.key === heading?.key || field.key === summary?.key) {
      continue;
    }
    if (shouldShow(field)) {
      out.push(field);
    }
  }
  return appendMissingContributorFields(out);
}

/**
 * Resolves the display row for a tab/list selection when `rowId` is either the merged row id
 * or a Smartsheet source row id absorbed into a merge.
 */
export function findResolvedViewRowByIdOrMergedSource(
  rows: ResolvedViewRow[],
  rowId: number | null,
): ResolvedViewRow | null {
  if (rows.length === 0) {
    return null;
  }
  if (rowId == null) {
    return rows[0] ?? null;
  }
  return rows.find((row) => row.id === rowId || row.mergedSourceRowIds?.includes(rowId)) ?? rows[0] ?? null;
}

/** Minimum width per custom card column so multi-column layouts scroll on narrow viewports instead of collapsing. */
export const CUSTOM_CARD_COL_MIN_REM = 9;

/** Grid style for aligned custom card rows (header row + value row). */
export function customCardAlignedGridStyle(colCount: number): CSSProperties | undefined {
  if (colCount <= 1) {
    return undefined;
  }
  return {
    gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
    gridTemplateRows: "auto auto",
    minWidth: `${colCount * CUSTOM_CARD_COL_MIN_REM}rem`,
  };
}

/**
 * Outer wrapper for horizontal scroll when the inner grid is wider than the card
 * (typical on phones for multi-column custom layouts).
 */
export function customCardGridScrollWrapClassName(useAlignedGrid: boolean): string | undefined {
  if (!useAlignedGrid) {
    return undefined;
  }
  return "min-w-0 -mx-1 max-w-full touch-pan-x overflow-x-auto overscroll-x-contain px-1 [scrollbar-gutter:stable]";
}
