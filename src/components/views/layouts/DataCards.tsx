import { CardLayoutCellRenderer } from "@/components/views/layouts/CardLayoutCellRenderer";
import { CampusBadgeStrip } from "@/components/views/shared/CampusBadgeStrip";
import { ContributorEditButton, ContributorEditableBadge, getContributorRowAccentClass } from "@/components/views/contributor/ContributorRowControls";
import { ContributorCardEditShell } from "@/components/views/contributor/ContributorCardEditShell";
import { EmptyState } from "@/components/views/shared/EmptyState";
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
import type { ResolvedFieldValue, ResolvedView, ResolvedViewRow } from "@/lib/config/types";
import { contributorEditTargetRowId, isContributorRowOrMergedEditable } from "@/lib/contributor-utils";
import { fieldBlockOuterClassName } from "@/components/views/layouts/FieldBlock";
import { fieldLabelClassName } from "@/lib/field-typography";

function FieldBlock({ rowId, field }: { rowId: number; field: ResolvedFieldValue }) {
  return (
    <div key={`${rowId}-${field.key}`} className={fieldBlockOuterClassName(field)}>
      {!field.hideLabel && (
        <p className={fieldLabelClassName(field)}>{field.label}</p>
      )}
      <FieldValue field={field} stacked />
    </div>
  );
}

export function DataCards({
  view,
  programGroups,
  editableRowIds,
  onEditRow,
  editingRowId,
  onCancelEdit,
  slug,
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

  function renderCardRow(row: ResolvedViewRow) {
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
      const colCount = getCardLayoutColumnCount(view);
      const useAlignedGrid = colCount > 1;
      const gridClass = useAlignedGrid ? "grid gap-4" : "space-y-4";
      const gridStyle = useAlignedGrid ? customCardAlignedGridStyle(colCount) : undefined;
      const scrollWrap = customCardGridScrollWrapClassName(useAlignedGrid);
      return (
        <article
          key={row.id}
          id={`row-${row.id}`}
          className={`scroll-mt-24 rounded-[1.75rem] ${cardBorderClass} ${getContributorRowAccentClass(isEditable)} bg-[color:var(--wsu-paper)] p-5 shadow-[0_16px_40px_rgba(35,31,32,0.06)]`}
        >
          {isEditable && (
            <div className="mb-4 flex items-center justify-between gap-3">
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
              const paddedCells = useAlignedGrid
                ? [...cells.slice(0, colCount), ...Array(Math.max(0, colCount - cells.length)).fill({ type: "placeholder" as const })]
                : cells;
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
    const remaining = getVisibleRowFields(row, [heading?.key ?? "", summary?.key ?? ""]);

    return (
      <article
        key={row.id}
        id={`row-${row.id}`}
        className={`scroll-mt-24 rounded-[1.75rem] ${cardBorderClass} ${getContributorRowAccentClass(isEditable)} bg-[color:var(--wsu-paper)] p-5 shadow-[0_16px_40px_rgba(35,31,32,0.06)]`}
      >
        {isEditable && (
          <div className="mb-4 flex items-center justify-between gap-3">
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
          <>
            {heading && !(heading.hideWhenEmpty && heading.isEmpty) && (
              <div className="border-b border-[color:var(--wsu-border)] pb-4">
                {!heading.hideLabel ? (
                  <>
                    <p className={fieldLabelClassName(heading)}>{heading.label}</p>
                    <div className="view-row-heading mt-2">
                      <FieldValue field={heading} />
                    </div>
                  </>
                ) : (
                  <div className="view-row-heading">
                    <FieldValue field={heading} />
                  </div>
                )}
                {summary && (
                  <div className="mt-2 text-sm text-[color:var(--wsu-muted)]">
                    <FieldValue field={summary} />
                  </div>
                )}
              </div>
            )}
            <div className="mt-4 space-y-4">
              {remaining.map((field) => (
                <FieldBlock key={`${row.id}-${field.key}`} rowId={row.id} field={field} />
              ))}
            </div>
          </>
        </RecordSuppressionCollapsible>
      </article>
    );
  }

  if (programGroups && programGroups.length > 0) {
    return (
      <div className="space-y-8 md:space-y-10">
        {programGroups.map((group) => (
          <section key={group.id} id={`group-${group.id}`} className="scroll-mt-24 space-y-4">
            {showProgramSectionHeaders(view.presentation) ? (
              <header className="rounded-2xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/35 px-4 py-3 sm:px-5">
                <h2 className="font-view-heading text-lg font-semibold text-[color:var(--wsu-ink)] sm:text-xl">{group.label}</h2>
                {showCampusStripOnProgramSections(view.presentation) ? (
                  <CampusBadgeStrip campuses={group.campuses} badgeStyle={view.presentation?.campusBadgeStyle} />
                ) : null}
              </header>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{group.rows.map((row) => renderCardRow(row))}</div>
          </section>
        ))}
      </div>
    );
  }

  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{view.rows.map((row) => renderCardRow(row))}</div>;
}
