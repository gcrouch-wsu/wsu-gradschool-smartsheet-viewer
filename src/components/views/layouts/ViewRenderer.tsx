"use client";

import { DataAccordion } from "@/components/views/layouts/DataAccordion";
import { DataCards } from "@/components/views/layouts/DataCards";
import { DataList } from "@/components/views/layouts/DataList";
import { DataListDetail } from "@/components/views/layouts/DataListDetail";
import { DataStacked } from "@/components/views/layouts/DataStacked";
import { DataTabbed } from "@/components/views/layouts/DataTabbed";
import { DataTable } from "@/components/views/layouts/DataTable";
import { CampusBadgeStyleProvider } from "@/components/views/shared/CampusBadgeStyleContext";
import { ViewValueLinkProvider } from "@/components/views/shared/ViewValueLinkContext";
import type { ProgramGroup } from "@/lib/campus-grouping";
import type { LayoutType, ResolvedView } from "@/lib/config/types";

export interface PublicRowEditingProps {
  editableRowIds?: Set<number>;
  onEditRow?: (rowId: number, triggerElement?: HTMLElement | null) => void;
  editingRowId?: number | null;
  onCancelEdit?: () => void;
  slug?: string;
}

export function PublicViewRenderer({
  layout,
  view,
  programGroups,
  editableRowIds,
  onEditRow,
  editingRowId,
  onCancelEdit,
  slug,
}: {
  layout: LayoutType;
  view: ResolvedView;
  /** Present when campus/program grouping is active; layouts consume in Step D. */
  programGroups?: ProgramGroup[];
} & PublicRowEditingProps) {
  const linkCtx = {
    linkEmailsInView: view.linkEmailsInView,
    linkPhonesInView: view.linkPhonesInView,
  };

  const body =
    layout === "cards" ? (
      <DataCards
        view={view}
        programGroups={programGroups}
        editableRowIds={editableRowIds}
        onEditRow={onEditRow}
        editingRowId={editingRowId}
        onCancelEdit={onCancelEdit}
        slug={slug}
      />
    ) : layout === "list" ? (
      <DataList
        view={view}
        programGroups={programGroups}
        editableRowIds={editableRowIds}
        onEditRow={onEditRow}
        editingRowId={editingRowId}
        onCancelEdit={onCancelEdit}
        slug={slug}
      />
    ) : layout === "stacked" ? (
      <DataStacked
        view={view}
        programGroups={programGroups}
        editableRowIds={editableRowIds}
        onEditRow={onEditRow}
        editingRowId={editingRowId}
        onCancelEdit={onCancelEdit}
        slug={slug}
      />
    ) : layout === "accordion" ? (
      <DataAccordion
        view={view}
        programGroups={programGroups}
        editableRowIds={editableRowIds}
        onEditRow={onEditRow}
        editingRowId={editingRowId}
        onCancelEdit={onCancelEdit}
        slug={slug}
      />
    ) : layout === "tabbed" ? (
      <DataTabbed
        view={view}
        programGroups={programGroups}
        editableRowIds={editableRowIds}
        onEditRow={onEditRow}
        editingRowId={editingRowId}
        onCancelEdit={onCancelEdit}
        slug={slug}
      />
    ) : layout === "list_detail" ? (
      <DataListDetail
        view={view}
        programGroups={programGroups}
        editableRowIds={editableRowIds}
        onEditRow={onEditRow}
        editingRowId={editingRowId}
        onCancelEdit={onCancelEdit}
        slug={slug}
      />
    ) : (
      <DataTable view={view} programGroups={programGroups} editableRowIds={editableRowIds} onEditRow={onEditRow} />
    );

  return (
    <ViewValueLinkProvider value={linkCtx}>
      <CampusBadgeStyleProvider style={view.presentation?.campusBadgeStyle}>{body}</CampusBadgeStyleProvider>
    </ViewValueLinkProvider>
  );
}
