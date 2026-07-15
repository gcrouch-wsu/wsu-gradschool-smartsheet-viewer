import { CardLayoutCellRenderer } from "@/components/views/layouts/CardLayoutCellRenderer";
import { CampusBadgeStrip } from "@/components/views/shared/CampusBadgeStrip";
import { ContributorEditButton, ContributorEditableBadge, getContributorRowAccentClass } from "@/components/views/contributor/ContributorRowControls";
import { ContributorCardEditShell } from "@/components/views/contributor/ContributorCardEditShell";
import { EmptyState } from "@/components/views/shared/EmptyState";
import { FieldBlock } from "@/components/views/layouts/FieldBlock";
import { FieldValue } from "@/components/views/layouts/FieldValue";
import { MergedRowCampusBadges } from "@/components/views/shared/MergedRowCampusBadges";
import { RecordSuppressionCollapsible } from "@/components/views/shared/RecordSuppressionCollapsible";
import {
  cardLayoutContinuationRowClass,
  customCardAlignedGridStyle,
  customCardGridScrollWrapClassName,
  cardLayoutIncludesCampusBadges,
  getCardLayoutColumnCount,
  getCardLayoutRows,
  getRowHeadingField,
  getRowSummaryField,
  getVisibleRowFields,
  hasCustomCardLayout,
} from "@/components/views/layouts/layout-utils";
import type { ProgramGroup } from "@/lib/campus-grouping";
import {
  showCampusStripOnProgramSections,
  showProgramSectionHeaders,
  suppressMergedRowCampusBadgesWhenSectionStripShows,
} from "@/lib/campus-grouping";
import type { ResolvedView, ResolvedViewRow } from "@/lib/config/types";
import { contributorEditTargetRowId, isContributorRowOrMergedEditable } from "@/lib/contributor-utils";
import { fieldLabelClassName } from "@/lib/field-typography";

export function DataStacked({
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
  const cardBorderClass =
    dividerStyle === "none" ? "border-0" : dividerStyle === "subtle" ? "border border-[color:var(--wsu-border)]/40" : "border border-[color:var(--wsu-border)]";
  const rowDividerClass = (rowIndex: number) =>
    rowIndex > 0
      ? dividerStyle === "none"
        ? "mt-4 pt-4"
        : dividerStyle === "subtle"
          ? "mt-4 border-t border-[color:var(--wsu-border)]/40 pt-4"
          : "mt-4 border-t border-[color:var(--wsu-border)] pt-4"
      : "";

  function renderStackedRow(row: ResolvedViewRow) {
    const isEditingThisRow = editingRowId === row.id || (row.mergedSourceRowIds?.includes(editingRowId ?? -1) ?? false);

    if (isEditingThisRow && onCancelEdit) {
      return (
        <ContributorCardEditShell
          key={`edit-${row.id}`}
          slug={slug ?? ""}
          view={view}
          row={row}
          onCancel={onCancelEdit}
        />
      );
    }
    const customRows = hasCustomCardLayout(view) ? getCardLayoutRows(view, row) : [];
    const isEditable = isContributorRowOrMergedEditable(row, editableRowIds);
    const editTargetId = contributorEditTargetRowId(row, editableRowIds);

    if (customRows.length > 0) {
      return (
        <article
          key={row.id}
          id={`row-${row.id}`}
          className={`scroll-mt-24 rounded-2xl sm:rounded-[1.75rem] ${cardBorderClass} ${getContributorRowAccentClass(isEditable)} bg-[color:var(--wsu-paper)] p-4 shadow-[0_16px_40px_rgba(35,31,32,0.06)] sm:p-5`}
        >
          {isEditable && (
            <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
              <ContributorEditableBadge />
              <ContributorEditButton rowId={editTargetId} onEditRow={onEditRow} compact />
            </div>
          )}
          {!cardLayoutIncludesCampusBadges(view) ? (
            <MergedRowCampusBadges
              row={row}
              suppressWhenProgramSections={suppressMergedRowCampusBadgesWhenSectionStripShows(view.presentation)}
              presentation={view.presentation}
            />
          ) : null}
          <RecordSuppressionCollapsible view={view} row={row}>
            {customRows.map((cells, rowIndex) => {
            const colCount = getCardLayoutColumnCount(view);
            const useAlignedGrid = colCount > 1;
            const gridClass = useAlignedGrid ? "grid gap-2 sm:gap-3 md:gap-4" : "space-y-2 sm:space-y-3 md:space-y-4";
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
                className={cardLayoutContinuationRowClass(paddedCells, rowIndex, rowDividerClass(rowIndex))}
              >
                {scrollWrap ? <div className={scrollWrap}>{gridInner}</div> : gridInner}
              </div>
            );
          })}
          </RecordSuppressionCollapsible>
        </article>
      );
    }

    const heading = getRowHeadingField(view, row);
    const summary = getRowSummaryField(view, row, heading?.key);
    const bodyFields = getVisibleRowFields(row, [heading?.key ?? "", summary?.key ?? ""]);

    return (
      <article
        key={row.id}
        id={`row-${row.id}`}
        className={`scroll-mt-24 rounded-2xl sm:rounded-[1.75rem] ${cardBorderClass} ${getContributorRowAccentClass(isEditable)} bg-[color:var(--wsu-paper)] p-4 shadow-[0_16px_40px_rgba(35,31,32,0.06)] sm:p-5`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[color:var(--wsu-border)] pb-3 sm:gap-4 sm:pb-4">
          <div className="min-w-0">
            {heading && !(heading.hideWhenEmpty && heading.isEmpty) && (
              <div>
                {!heading.hideLabel && (
                  <p className={fieldLabelClassName(heading)}>{heading.label}</p>
                )}
                <div className="view-row-heading mt-2">
                  <FieldValue field={heading} />
                </div>
              </div>
            )}
            {summary && (
              <div className="mt-2 text-sm text-[color:var(--wsu-muted)]">
                <FieldValue field={summary} />
              </div>
            )}
            {!cardLayoutIncludesCampusBadges(view) ? (
              <MergedRowCampusBadges
                row={row}
                suppressWhenProgramSections={suppressMergedRowCampusBadgesWhenSectionStripShows(view.presentation)}
                presentation={view.presentation}
              />
            ) : null}
          </div>
          {!view.presentation?.hideRowBadge && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {isEditable && <ContributorEditableBadge />}
              <div className="rounded-full border border-[color:var(--wsu-border)] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">
                Row {row.id}
              </div>
              {isEditable && <ContributorEditButton rowId={editTargetId} onEditRow={onEditRow} compact />}
            </div>
          )}
        </div>
        <RecordSuppressionCollapsible view={view} row={row}>
          <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {bodyFields.map((field) => (
              <div key={`${row.id}-${field.key}`}>
                <FieldBlock field={field} compact inCssGrid />
              </div>
            ))}
          </div>
        </RecordSuppressionCollapsible>
      </article>
    );
  }

  if (programGroups && programGroups.length > 0) {
    return (
      <div className="space-y-6 md:space-y-8">
        {programGroups.map((group) => (
          <section key={group.id} id={`group-${group.id}`} className="scroll-mt-24 space-y-3 md:space-y-4">
            {showProgramSectionHeaders(view.presentation) ? (
              <header className="rounded-2xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/35 px-4 py-3 sm:px-5">
                <h2 className="font-view-heading text-lg font-semibold text-[color:var(--wsu-ink)] sm:text-xl">{group.label}</h2>
                {showCampusStripOnProgramSections(view.presentation) ? (
                  <CampusBadgeStrip campuses={group.campuses} badgeStyle={view.presentation?.campusBadgeStyle} />
                ) : null}
              </header>
            ) : null}
            <div className="space-y-3 md:space-y-4">{group.rows.map((row) => renderStackedRow(row))}</div>
          </section>
        ))}
      </div>
    );
  }

  return <div className="space-y-3 md:space-y-4">{view.rows.map((row) => renderStackedRow(row))}</div>;
}
