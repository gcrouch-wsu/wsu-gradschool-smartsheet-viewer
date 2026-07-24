import { CardLayoutCellRenderer } from "@/components/views/layouts/CardLayoutCellRenderer";
import { CampusBadgeStrip } from "@/components/views/shared/CampusBadgeStrip";
import { ContributorCardEditShell } from "@/components/views/contributor/ContributorCardEditShell";
import { ContributorEditButton, ContributorEditableBadge, getContributorRowAccentClass } from "@/components/views/contributor/ContributorRowControls";
import { EmptyState } from "@/components/views/shared/EmptyState";
import { FieldValue } from "@/components/views/layouts/FieldValue";
import {
  cardLayoutContinuationRowClass,
  customCardAlignedGridStyle,
  customCardGridScrollWrapClassName,
  cardLayoutIncludesCampusBadges,
  getCardLayoutColumnCount,
  getCardLayoutRows,
  hasCustomCardLayout,
} from "@/components/views/layouts/layout-utils";
import type { ProgramGroup } from "@/lib/campus-grouping";
import {
  showCampusStripOnProgramSections,
  showProgramSectionHeaders,
  suppressMergedRowCampusBadgesWhenSectionStripShows,
} from "@/lib/campus-grouping";
import type { ResolvedFieldValue, ResolvedView, ResolvedViewRow } from "@/lib/config/types";
import { contributorEditTargetRowId, isContributorRowOrMergedEditable } from "@/lib/contributor-utils";
import { MergedRowCampusBadges } from "@/components/views/shared/MergedRowCampusBadges";
import { RecordSuppressionCollapsible } from "@/components/views/shared/RecordSuppressionCollapsible";
import { fieldBlockOuterClassName } from "@/components/views/layouts/FieldBlock";
import { fieldLabelClassName } from "@/lib/field-typography";

function FieldBlock({ rowId, field }: { rowId: number; field: ResolvedFieldValue }) {
  return (
    <div key={`${rowId}-${field.key}`} className={fieldBlockOuterClassName(field, undefined, { inCssGrid: true })}>
      {!field.hideLabel && (
        <p className={fieldLabelClassName(field)}>{field.label}</p>
      )}
      <FieldValue field={field} stacked />
    </div>
  );
}

export function DataList({
  view,
  programGroups,
  editableRowIds,
  onEditRow,
  editingRowId,
  onCancelEdit,
  slug = "",
}: {
  view: ResolvedView;
  programGroups?: ProgramGroup[];
  editableRowIds?: Set<number>;
  onEditRow?: (rowId: number, triggerElement?: HTMLElement | null) => void;
  editingRowId?: number | null;
  onCancelEdit?: () => void;
  slug?: string;
}) {
  if (view.rows.length === 0) {
    return <EmptyState label={`No ${view.label.toLowerCase()} records found.`} />;
  }

  const dividerStyle = view.presentation?.rowDividerStyle ?? "default";
  const listDividerClass =
    dividerStyle === "none" ? "" : dividerStyle === "subtle" ? "divide-y divide-[color:var(--wsu-border)]/40" : "divide-y divide-[color:var(--wsu-border)]/70";

  function renderListItem(row: ResolvedViewRow) {
    const isEditingThisRow = editingRowId === row.id || (row.mergedSourceRowIds?.includes(editingRowId ?? -1) ?? false);

    if (isEditingThisRow && onCancelEdit) {
      return (
        <li key={row.id} id={`row-${row.id}`} className="scroll-mt-24 list-none px-5 py-5">
          <ContributorCardEditShell slug={slug} view={view} row={row} onCancel={onCancelEdit} />
        </li>
      );
    }

    const customRows = hasCustomCardLayout(view) ? getCardLayoutRows(view, row) : [];
    const isEditable = isContributorRowOrMergedEditable(row, editableRowIds);
    const editTargetId = contributorEditTargetRowId(row, editableRowIds);
    const mergeBadges = !cardLayoutIncludesCampusBadges(view) ? (
      <MergedRowCampusBadges
        row={row}
        suppressWhenProgramSections={suppressMergedRowCampusBadgesWhenSectionStripShows(view.presentation)}
        presentation={view.presentation}
      />
    ) : null;

    if (customRows.length > 0) {
      return (
        <li key={row.id} id={`row-${row.id}`} className={`scroll-mt-24 px-5 py-5 ${getContributorRowAccentClass(isEditable)}`}>
          {isEditable && (
            <div className="mb-4 flex items-center justify-between gap-3">
              <ContributorEditableBadge />
              <ContributorEditButton rowId={editTargetId} onEditRow={onEditRow} compact />
            </div>
          )}
          {mergeBadges}
          <RecordSuppressionCollapsible view={view} row={row}>
            <div className="space-y-4">
              {customRows.map((cells, rowIndex) => {
              const rowDividerClass =
                rowIndex > 0
                  ? dividerStyle === "none"
                    ? "pt-4"
                    : dividerStyle === "subtle"
                      ? "border-t border-[color:var(--wsu-border)]/40 pt-4"
                      : "border-t border-[color:var(--wsu-border)] pt-4"
                  : "";
              const colCount = getCardLayoutColumnCount(view);
              const useAlignedGrid = colCount > 1;
              const gridClass = useAlignedGrid ? "grid gap-4" : "space-y-4";
              const gridStyle = useAlignedGrid ? customCardAlignedGridStyle(colCount) : undefined;
              const scrollWrap = customCardGridScrollWrapClassName(useAlignedGrid);
              const paddedCells = useAlignedGrid ? [...cells.slice(0, colCount), ...Array(Math.max(0, colCount - cells.length)).fill({ type: "placeholder" as const })] : cells;
              const gridInner = (
                <div className={gridClass} style={gridStyle}>
                  {useAlignedGrid ? (
                    <>
                      {paddedCells.map((cell, i) => (
                        <CardLayoutCellRenderer key={`h-${i}`} cell={cell} flexClass="min-w-0" mode="header" />
                      ))}
                      {paddedCells.map((cell, i) => (
                        <CardLayoutCellRenderer key={`v-${i}`} cell={cell} flexClass="min-w-0" mode="value" />
                      ))}
                    </>
                  ) : (
                    paddedCells.map((cell, i) => (
                      <CardLayoutCellRenderer key={i} cell={cell} flexClass="w-full" />
                    ))
                  )}
                </div>
              );
              return (
                <div
                  key={rowIndex}
                  className={cardLayoutContinuationRowClass(paddedCells, rowIndex, rowDividerClass)}
                >
                  {scrollWrap ? <div className={scrollWrap}>{gridInner}</div> : gridInner}
                </div>
              );
            })}
            </div>
          </RecordSuppressionCollapsible>
        </li>
      );
    }

    return (
      <li key={row.id} id={`row-${row.id}`} className={`scroll-mt-24 px-5 py-5 ${getContributorRowAccentClass(isEditable)}`}>
        {isEditable && (
          <div className="mb-4 flex items-center justify-between gap-3">
            <ContributorEditableBadge />
            <ContributorEditButton rowId={editTargetId} onEditRow={onEditRow} compact />
          </div>
        )}
        {mergeBadges}
        <RecordSuppressionCollapsible view={view} row={row}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {row.fields
              .filter((field) => !(field.hideWhenEmpty && field.isEmpty))
              .map((field) => (
                <FieldBlock key={`${row.id}-${field.key}`} rowId={row.id} field={field} />
              ))}
          </div>
        </RecordSuppressionCollapsible>
      </li>
    );
  }

  if (programGroups && programGroups.length > 0) {
    return (
      <div className="space-y-6 md:space-y-8">
        {programGroups.map((group) => (
          <section key={group.id} id={`group-${group.id}`} className="scroll-mt-24">
            {showProgramSectionHeaders(view.presentation) ? (
              <header className="mb-3 rounded-2xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/35 px-4 py-3 sm:px-5">
                <h2 className="font-view-heading text-lg font-semibold text-[color:var(--wsu-ink)] sm:text-xl">{group.label}</h2>
                {showCampusStripOnProgramSections(view.presentation) ? (
                  <CampusBadgeStrip campuses={group.campuses} badgeStyle={view.presentation?.campusBadgeStyle} />
                ) : null}
              </header>
            ) : null}
            <div className="overflow-hidden rounded-[1.75rem] border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] shadow-[0_16px_40px_rgba(35,31,32,0.06)]">
              <ul className={listDividerClass}>{group.rows.map((row) => renderListItem(row))}</ul>
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] shadow-[0_16px_40px_rgba(35,31,32,0.06)]">
      <ul className={listDividerClass}>{view.rows.map((row) => renderListItem(row))}</ul>
    </div>
  );
}
