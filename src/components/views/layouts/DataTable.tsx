import { CampusBadgeStrip } from "@/components/views/shared/CampusBadgeStrip";
import { ContributorEditButton, getContributorRowAccentClass } from "@/components/views/contributor/ContributorRowControls";
import { contributorEditTargetRowId, isContributorRowOrMergedEditable } from "@/lib/contributor-utils";
import { EmptyState } from "@/components/views/shared/EmptyState";
import { FieldValue } from "@/components/views/layouts/FieldValue";
import type { ProgramGroup } from "@/lib/campus-grouping";
import { showCampusStripOnProgramSections, showProgramSectionHeaders } from "@/lib/campus-grouping";
import type { ResolvedView } from "@/lib/config/types";

export function DataTable({
  view,
  programGroups,
  editableRowIds,
  onEditRow,
}: {
  view: ResolvedView;
  programGroups?: ProgramGroup[];
  editableRowIds?: Set<number>;
  onEditRow?: (rowId: number, triggerElement?: HTMLElement | null) => void;
}) {
  if (view.rows.length === 0) {
    return <EmptyState label={`No ${view.label.toLowerCase()} records found.`} />;
  }

  const actionCol = Boolean(onEditRow);
  const colSpan = view.fields.length + (actionCol ? 1 : 0);

  const thead = (
    <thead className="sticky top-0 z-10">
      <tr className="border-b border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/90 backdrop-blur-sm">
        {view.fields.map((field) => (
          <th
            key={field.key}
            scope="col"
            className="view-field-label whitespace-nowrap px-3 py-2.5 text-left text-[color:var(--wsu-muted)] first:pl-4 last:pr-4"
          >
            {field.label}
          </th>
        ))}
        {actionCol ? (
          <th
            scope="col"
            className="view-field-label px-3 py-2.5 pr-4 text-right text-[color:var(--wsu-muted)]"
          >
            Actions
          </th>
        ) : null}
      </tr>
    </thead>
  );

  function renderBodyRows(rows: typeof view.rows) {
    return rows.map((row) => {
      const isEditable = isContributorRowOrMergedEditable(row, editableRowIds);
      const editTargetId = contributorEditTargetRowId(row, editableRowIds);
      const sup = row.recordSuppression;
      return (
        <tr
          key={row.id}
          id={`row-${row.id}`}
          className={`border-b border-[color:var(--wsu-border)]/60 align-top transition-colors last:border-b-0 scroll-mt-24 hover:bg-[color:var(--wsu-stone)]/35 ${getContributorRowAccentClass(isEditable)} ${sup ? "bg-amber-50/30" : ""}`}
        >
          {row.fields.map((field, colIndex) => (
            <td key={`${row.id}-${field.key}`} className="px-3 py-3 text-sm first:pl-4 last:pr-4">
              <div className="space-y-1.5">
                {colIndex === 0 && sup ? (
                  <p className="m-0">
                    <span className="inline-flex rounded-md border border-amber-300/90 bg-amber-100/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950">
                      {sup.statusDisplay}
                    </span>
                  </p>
                ) : null}
                <FieldValue field={field} />
              </div>
            </td>
          ))}
          {actionCol ? (
            <td className="px-3 py-3 pr-4 text-right">
              {isEditable ? <ContributorEditButton rowId={editTargetId} onEditRow={onEditRow} compact /> : null}
            </td>
          ) : null}
        </tr>
      );
    });
  }

  if (programGroups && programGroups.length > 0) {
    return (
      <div className="view-data-panel">
        <div className="touch-pan-x overflow-x-auto overscroll-x-contain">
          <table className="min-w-full border-collapse text-left text-sm">
            <caption className="sr-only">
              {view.label}: {view.rowCount} row{view.rowCount === 1 ? "" : "s"}
            </caption>
            {thead}
            {programGroups.map((group) => (
              <tbody key={group.id} id={`group-${group.id}`} className="scroll-mt-24">
                {showProgramSectionHeaders(view.presentation) ? (
                  <tr className="border-b border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/30">
                    <th colSpan={colSpan} className="px-4 py-2.5 text-left align-top">
                      <div className="text-sm font-semibold text-[color:var(--wsu-ink)]">{group.label}</div>
                      {showCampusStripOnProgramSections(view.presentation) ? (
                        <CampusBadgeStrip
                          campuses={group.campuses}
                          className="mt-1"
                          badgeStyle={view.presentation?.campusBadgeStyle}
                        />
                      ) : null}
                    </th>
                  </tr>
                ) : null}
                {renderBodyRows(group.rows)}
              </tbody>
            ))}
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="view-data-panel">
      <div className="touch-pan-x overflow-x-auto overscroll-x-contain">
        <table className="min-w-full border-collapse text-left text-sm">
          <caption className="sr-only">
            {view.label}: {view.rowCount} row{view.rowCount === 1 ? "" : "s"}
          </caption>
          {thead}
          <tbody>{renderBodyRows(view.rows)}</tbody>
        </table>
      </div>
    </div>
  );
}
