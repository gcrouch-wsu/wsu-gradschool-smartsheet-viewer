"use client";

import { useState } from "react";
import { CardLayoutCellRenderer } from "@/components/views/layouts/CardLayoutCellRenderer";
import { DataStacked } from "@/components/views/layouts/DataStacked";
import { ContributorCardEditShell } from "@/components/views/contributor/ContributorCardEditShell";
import {
  ContributorEditButton,
  ContributorEditableBadge,
  getContributorRowAccentClass,
} from "@/components/views/contributor/ContributorRowControls";
import { EmptyState } from "@/components/views/shared/EmptyState";
import { FieldValue } from "@/components/views/layouts/FieldValue";
import {
  cardLayoutContinuationRowClass,
  customCardAlignedGridStyle,
  customCardGridScrollWrapClassName,
  describeResolvedField,
  cardLayoutIncludesCampusBadges,
  findResolvedViewRowByIdOrMergedSource,
  getCardLayoutColumnCount,
  getCardLayoutRows,
  getRowHeadingField,
  getRowHeadingText,
  getRowSummaryField,
  getVisibleRowFields,
  hasCustomCardLayout,
} from "@/components/views/layouts/layout-utils";
import { MergedRowCampusBadges } from "@/components/views/shared/MergedRowCampusBadges";
import { RecordSuppressionCollapsible } from "@/components/views/shared/RecordSuppressionCollapsible";
import type { ProgramGroup } from "@/lib/campus-grouping";
import { suppressMergedRowCampusBadgesWhenSectionStripShows } from "@/lib/campus-grouping";
import { contributorEditTargetRowId, isContributorRowOrMergedEditable } from "@/lib/contributor-utils";
import type { ResolvedFieldValue, ResolvedView } from "@/lib/config/types";
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

export function DataTabbed({
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
  const [activeRowId, setActiveRowId] = useState<number | null>(view.rows[0]?.id ?? null);

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

  const activeRow = findResolvedViewRowByIdOrMergedSource(view.rows, activeRowId);
  if (!activeRow) {
    return <EmptyState label={`No ${view.label.toLowerCase()} records found.`} />;
  }
  const activeRowEditable = isContributorRowOrMergedEditable(activeRow, editableRowIds);
  const activeEditTargetId = contributorEditTargetRowId(activeRow, editableRowIds);

  const heading = getRowHeadingField(view, activeRow);
  const summary = getRowSummaryField(view, activeRow, heading?.key);
  const bodyFields = getVisibleRowFields(activeRow, [heading?.key ?? "", summary?.key ?? ""]);

  const dividerStyle = view.presentation?.rowDividerStyle ?? "default";
  const cardBorderClass =
    dividerStyle === "none" ? "border-0" : dividerStyle === "subtle" ? "border border-[color:var(--wsu-border)]/40" : "border border-[color:var(--wsu-border)]";
  const rowDividerClass = (rowIndex: number) =>
    rowIndex > 0
      ? dividerStyle === "none"
        ? "pt-4"
        : dividerStyle === "subtle"
          ? "border-t border-[color:var(--wsu-border)]/40 pt-4"
          : "border-t border-[color:var(--wsu-border)] pt-4"
      : "";

  const detailPanelId = "record-tabbed-detail-panel";

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Records" className="flex flex-wrap gap-2">
        {view.rows.map((row) => {
          const active = row.id === activeRow.id;
          const isEditable = isContributorRowOrMergedEditable(row, editableRowIds);
          const rowHeading = getRowHeadingField(view, row);
          const label = rowHeading ? describeResolvedField(rowHeading) || `Row ${row.id}` : `Row ${row.id}`;
          const sup = row.recordSuppression;

          return (
            <button
              key={row.id}
              id={`row-${row.id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={detailPanelId}
              tabIndex={active ? 0 : -1}
              onClick={() => setActiveRowId(row.id)}
              className={active ? "view-control-active px-4 py-2 text-sm font-medium" : isEditable ? "view-control-primary px-4 py-2 text-sm font-medium" : "view-control px-4 py-2 text-sm font-medium"}
            >
              <span className="inline-flex flex-col items-start gap-1">
                {sup ? (
                  <span className="rounded-full border border-amber-200/90 bg-amber-100/40 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-950">
                    {sup.statusDisplay}
                  </span>
                ) : null}
                <span>{label}</span>
              </span>
            </button>
          );
        })}
      </div>

      <article
        role="tabpanel"
        id={detailPanelId}
        aria-labelledby={`row-${activeRow.id}`}
        className={`rounded-[1.75rem] ${cardBorderClass} ${getContributorRowAccentClass(activeRowEditable)} bg-[color:var(--wsu-paper)] p-6 shadow-[0_16px_40px_rgba(35,31,32,0.06)]`}
      >
        {(() => {
          const isEditingThisRow = editingRowId === activeRow.id || (activeRow.mergedSourceRowIds?.includes(editingRowId ?? -1) ?? false);
          if (isEditingThisRow && onCancelEdit) {
            return (
              <ContributorCardEditShell
                slug={slug ?? ""}
                view={view}
                row={activeRow}
                onCancel={onCancelEdit}
              />
            );
          }

          return (
            <>
              <p className="sr-only" aria-live="polite" aria-atomic="true">
                Selected: {getRowHeadingText(view, activeRow)}
              </p>
              <div className="border-b border-[color:var(--wsu-border)] pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="view-field-label text-[color:var(--wsu-muted)]">Selected record</p>
                    <h3 className="view-row-heading mt-2">
                      {getRowHeadingText(view, activeRow)}
                    </h3>
                    {summary && <div className="mt-2 text-sm text-[color:var(--wsu-muted)]"><FieldValue field={summary} /></div>}
                  </div>
                  {activeRowEditable && (
                    <div className="flex items-center gap-2">
                      <ContributorEditableBadge />
                      <ContributorEditButton rowId={activeEditTargetId} onEditRow={onEditRow} />
                    </div>
                  )}
                </div>
              </div>
              <RecordSuppressionCollapsible view={view} row={activeRow}>
                {!cardLayoutIncludesCampusBadges(view) ? (
                  <MergedRowCampusBadges
                    row={activeRow}
                    suppressWhenProgramSections={suppressMergedRowCampusBadgesWhenSectionStripShows(view.presentation)}
                    presentation={view.presentation}
                  />
                ) : null}
                {hasCustomCardLayout(view) ? (
                  <div className="mt-5 space-y-4">
                    {getCardLayoutRows(view, activeRow).map((cells, rowIndex) => {
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
                ) : (
                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {heading && !(heading.hideWhenEmpty && heading.isEmpty) && (
                      <div className="space-y-1">
                        {!heading.hideLabel && (
                          <p className={fieldLabelClassName(heading)}>{heading.label}</p>
                        )}
                        <FieldValue field={heading} stacked />
                      </div>
                    )}
                    {bodyFields.map((field) => (
                      <FieldBlock key={`${activeRow.id}-${field.key}`} rowId={activeRow.id} field={field} />
                    ))}
                  </div>
                )}
              </RecordSuppressionCollapsible>
            </>
          );
        })()}
      </article>
    </div>
  );
}
