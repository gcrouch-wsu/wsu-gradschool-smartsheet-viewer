import { CardLayoutCellRenderer } from "@/components/views/layouts/CardLayoutCellRenderer";
import { DataStacked } from "@/components/views/layouts/DataStacked";
import { ContributorEditButton, ContributorEditableBadge, getContributorRowAccentClass } from "@/components/views/contributor/ContributorRowControls";
import { ContributorCardEditShell } from "@/components/views/contributor/ContributorCardEditShell";
import { EmptyState } from "@/components/views/shared/EmptyState";
import { FieldValue } from "@/components/views/layouts/FieldValue";
import {
  cardLayoutContinuationRowClass,
  customCardAlignedGridStyle,
  customCardGridScrollWrapClassName,
  describeResolvedField,
  cardLayoutIncludesCampusBadges,
  getCardLayoutColumnCount,
  getCardLayoutRows,
  getFirstFieldFromCells,
  getRowHeadingField,
  getRowHeadingText,
  getRowSummaryField,
  getVisibleRowFields,
  hasCustomCardLayout,
} from "@/components/views/layouts/layout-utils";
import { MergedRowCampusBadges } from "@/components/views/shared/MergedRowCampusBadges";
import { fieldLabelClassName } from "@/lib/field-typography";
import type { ProgramGroup } from "@/lib/campus-grouping";
import { suppressMergedRowCampusBadgesWhenSectionStripShows } from "@/lib/campus-grouping";
import { contributorEditTargetRowId, isContributorRowOrMergedEditable } from "@/lib/contributor-utils";
import { fieldBlockOuterClassName } from "@/components/views/layouts/FieldBlock";
import type { ResolvedFieldValue, ResolvedView } from "@/lib/config/types";

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

export function DataAccordion({
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
  if (programGroups && programGroups.length > 0) {
    return (
      <DataStacked
        view={view}
        programGroups={programGroups}
        editableRowIds={editableRowIds}
        onEditRow={onEditRow}
        editingRowId={editingRowId}
        onCancelEdit={onCancelEdit}
        slug={slug}
      />
    );
  }
  if (view.rows.length === 0) {
    return <EmptyState label={`No ${view.label.toLowerCase()} records found.`} />;
  }

  const dividerStyle = view.presentation?.rowDividerStyle ?? "default";
  const cardBorderClass =
    dividerStyle === "none" ? "border-0" : dividerStyle === "subtle" ? "border border-[color:var(--wsu-border)]/40" : "border border-[color:var(--wsu-border)]";
  const innerBorderClass = dividerStyle === "none" ? "border-transparent" : dividerStyle === "subtle" ? "border-[color:var(--wsu-border)]/40" : "border-[color:var(--wsu-border)]";
  const rowDividerClass = (rowIndex: number) =>
    rowIndex > 0 ? (dividerStyle === "none" ? "mt-4 pt-4" : `mt-4 border-t ${innerBorderClass} pt-4`) : "";

  return (
    <div className="space-y-3">
      {view.rows.map((row, index) => {
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
          const firstRowCells = customRows[0] ?? [];
          const firstField = getFirstFieldFromCells(firstRowCells);
          const secondField = firstRowCells.find((c) => c.type === "field" && c.field.key !== firstField?.key);
          const summaryField = secondField?.type === "field" ? secondField.field : null;
          return (
            <details
              key={row.id}
              id={`row-${row.id}`}
              open={row.recordSuppression ? false : index === 0}
              className={`group scroll-mt-24 overflow-hidden rounded-[1.75rem] ${cardBorderClass} ${getContributorRowAccentClass(isEditable)} bg-[color:var(--wsu-paper)] shadow-[0_16px_40px_rgba(35,31,32,0.06)]`}
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div>
                  {row.recordSuppression ? (
                    <p className="mb-2">
                      <span className="inline-flex rounded-full border border-amber-300/90 bg-amber-100/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950">
                        {row.recordSuppression.statusDisplay}
                      </span>
                    </p>
                  ) : null}
                  <p className="view-row-heading">
                    {firstField ? describeResolvedField(firstField) : getRowHeadingText(view, row)}
                  </p>
                  {summaryField && (
                    <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">{describeResolvedField(summaryField) || summaryField.label}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isEditable && <ContributorEditableBadge />}
                  {isEditable && (
                    <ContributorEditButton rowId={editTargetId} onEditRow={onEditRow} compact stopPropagation />
                  )}
                  <span className="view-control px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] group-open:border-[color:var(--view-accent,var(--wsu-crimson))] group-open:text-[color:var(--view-accent,var(--wsu-crimson))]">
                    <span className="group-open:hidden">Expand</span>
                    <span className="hidden group-open:inline">Collapse</span>
                  </span>
                </div>
              </summary>
              <div className={`border-t ${innerBorderClass} px-5 py-5`}>
                <MergedRowCampusBadges
                  row={row}
                  suppressWhenProgramSections={suppressMergedRowCampusBadgesWhenSectionStripShows(view.presentation)}
                  presentation={view.presentation}
                />
                {customRows.map((cells, rowIndex) => {
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
                      className={cardLayoutContinuationRowClass(paddedCells, rowIndex, rowDividerClass(rowIndex))}
                    >
                      {scrollWrap ? <div className={scrollWrap}>{gridInner}</div> : gridInner}
                    </div>
                  );
                })}
              </div>
            </details>
          );
        }

        const heading = getRowHeadingField(view, row);
        const summary = getRowSummaryField(view, row, heading?.key);
        const bodyFields = getVisibleRowFields(row, [heading?.key ?? "", summary?.key ?? ""]);

        return (
          <details
            key={row.id}
            id={`row-${row.id}`}
            open={row.recordSuppression ? false : index === 0}
            className={`group scroll-mt-24 overflow-hidden rounded-[1.75rem] ${cardBorderClass} ${getContributorRowAccentClass(isEditable)} bg-[color:var(--wsu-paper)] shadow-[0_16px_40px_rgba(35,31,32,0.06)]`}
          >
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div>
                {row.recordSuppression ? (
                  <p className="mb-2">
                    <span className="inline-flex rounded-full border border-amber-300/90 bg-amber-100/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950">
                      {row.recordSuppression.statusDisplay}
                    </span>
                  </p>
                ) : null}
                <p className="view-row-heading">{getRowHeadingText(view, row)}</p>
                {summary && <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">{describeResolvedField(summary) || summary.label}</p>}
              </div>
              <div className="flex items-center gap-2">
                {isEditable && <ContributorEditableBadge />}
                {isEditable && (
                  <ContributorEditButton rowId={editTargetId} onEditRow={onEditRow} compact stopPropagation />
                )}
                <span className="view-control px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] group-open:border-[color:var(--view-accent,var(--wsu-crimson))] group-open:text-[color:var(--view-accent,var(--wsu-crimson))]">
                  <span className="group-open:hidden">Expand</span>
                  <span className="hidden group-open:inline">Collapse</span>
                </span>
              </div>
            </summary>
            <div className={`border-t ${innerBorderClass} px-5 py-5`}>
              {!cardLayoutIncludesCampusBadges(view) ? (
                <MergedRowCampusBadges
                  row={row}
                  suppressWhenProgramSections={suppressMergedRowCampusBadgesWhenSectionStripShows(view.presentation)}
                  presentation={view.presentation}
                />
              ) : null}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {heading && !(heading.hideWhenEmpty && heading.isEmpty) && (
                  <div className="space-y-1">
                    {!heading.hideLabel && (
                      <p className={fieldLabelClassName(heading)}>{heading.label}</p>
                    )}
                    <FieldValue field={heading} stacked />
                  </div>
                )}
                {summary && (
                  <div className="space-y-1">
                    {!summary.hideLabel && (
                      <p className={fieldLabelClassName(summary)}>{summary.label}</p>
                    )}
                    <FieldValue field={summary} stacked />
                  </div>
                )}
                {bodyFields.map((field) => (
                  <FieldBlock key={`${row.id}-${field.key}`} rowId={row.id} field={field} />
                ))}
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}
