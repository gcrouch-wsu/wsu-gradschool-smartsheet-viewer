"use client";

import React, { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import type { ResolvedView, ResolvedViewRow, EditableFieldGroup, ResolvedFieldValue } from "@/lib/config/types";
import { useContributorContext } from "@/components/views/contributor/ContributorContext";
import {
  ContributorGroupFieldControl,
  ContributorReadOnlyField,
  ContributorSingleFieldControl,
} from "@/components/views/contributor/ContributorFieldControl";
import {
  contributorEditTargetRowId,
  serializeContactDisplayToObjectValue,
  serializeMultiPersonToCells,
  parseMultiPersonRow,
  type MultiPersonEntry,
  type ContributorEditableFieldDefinition,
} from "@/lib/contributor-utils";
import {
  cardLayoutContinuationRowClass,
  getEditDrawerOrderedFields,
  hasCustomCardLayout,
  getCardLayoutRows,
  getCardLayoutColumnCount,
  customCardAlignedGridStyle,
  customCardGridScrollWrapClassName,
  getContributorEditorAdditionalOnlyFieldKeys,
  stripCardLayoutRowsForContributorMainEditor,
  sortContributorEditorAdditionalFields,
} from "@/components/views/layouts/layout-utils";
import { CardLayoutCellRenderer } from "@/components/views/layouts/CardLayoutCellRenderer";

const EMPTY_EDITABLE_FIELDS: ContributorEditableFieldDefinition[] = [];
const EMPTY_EDITABLE_GROUPS: EditableFieldGroup[] = [];

export function ContributorCardEditShell({
  slug,
  view,
  row,
  onCancel,
}: {
  slug: string;
  view: ResolvedView;
  row: ResolvedViewRow;
  onCancel: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const contributor = useContributorContext();
  const [isSaving, setIsSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showAdditional, setShowAdditional] = useState(false);

  const editingConfig = contributor?.editingConfig;
  const editableFields = editingConfig?.editableFields ?? EMPTY_EDITABLE_FIELDS;
  const editableFieldGroups = editingConfig?.editableFieldGroups ?? EMPTY_EDITABLE_GROUPS;

  const [formValues, setFormValues] = useState<Record<number, string>>(() => {
    return editableFields.reduce<Record<number, string>>((values, field) => {
      const text = row.fieldMap[field.fieldKey]?.textValue;
      values[field.columnId] = text ?? "";
      return values;
    }, {});
  });

  const [groupValues, setGroupValues] = useState<Record<string, MultiPersonEntry[]>>(() => {
    const nextGroups: Record<string, MultiPersonEntry[]> = {};
    for (const group of editableFieldGroups) {
      nextGroups[group.id] = parseMultiPersonRow(row, group);
    }
    return nextGroups;
  });

  const writableFieldGroups = useMemo(
    () => editableFieldGroups.filter((g) => !g.readOnly),
    [editableFieldGroups],
  );

  const patchRowId = useMemo(
    () => contributorEditTargetRowId(row, new Set(contributor?.editableRowIds)),
    [row, contributor?.editableRowIds],
  );

  const contributorFieldKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const f of editableFields) keys.add(f.fieldKey);
    for (const g of editableFieldGroups) {
      for (const a of g.attributes) keys.add(a.fieldKey);
    }
    return keys;
  }, [editableFields, editableFieldGroups]);

  const editableByFieldKey = useMemo(() => {
    const m = new Map<string, ContributorEditableFieldDefinition>();
    for (const f of editableFields) m.set(f.fieldKey, f);
    return m;
  }, [editableFields]);

  const groupByFieldKey = useMemo(() => {
    const m = new Map<string, EditableFieldGroup>();
    for (const g of editableFieldGroups) {
      for (const a of g.attributes) m.set(a.fieldKey, g);
    }
    return m;
  }, [editableFieldGroups]);

  const customRows = useMemo(() => {
    if (!hasCustomCardLayout(view)) return [];
    return getCardLayoutRows(view, row, {
      contributorFieldKeys,
      contributorEditableByKey: editableByFieldKey,
    });
  }, [view, row, contributorFieldKeys, editableByFieldKey]);

  const contributorAdditionalOnlyKeys = useMemo(
    () => getContributorEditorAdditionalOnlyFieldKeys(view),
    [view],
  );

  const editorMainCustomRows = useMemo(() => {
    if (customRows.length === 0) return [];
    return stripCardLayoutRowsForContributorMainEditor(
      customRows,
      contributorAdditionalOnlyKeys,
      view.presentation?.campusFieldKey,
    );
  }, [customRows, contributorAdditionalOnlyKeys, view.presentation?.campusFieldKey]);

  const allOrderedFields = useMemo(
    () => getEditDrawerOrderedFields(view, row, contributorFieldKeys, editableByFieldKey),
    [view, row, contributorFieldKeys, editableByFieldKey]
  );

  const [inCardFields, additionalFields] = useMemo(() => {
    const incard: ResolvedFieldValue[] = [];
    const additional: ResolvedFieldValue[] = [];
    const groupsSeen = new Set<string>();

    for (const f of allOrderedFields) {
      const group = groupByFieldKey.get(f.key);
      if (group) {
        if (groupsSeen.has(group.id)) continue;
        groupsSeen.add(group.id);
        incard.push(f);
        continue;
      }
      if (contributorAdditionalOnlyKeys.has(f.key)) {
        additional.push(f);
      } else {
        incard.push(f);
      }
    }
    return [incard, sortContributorEditorAdditionalFields(additional, view)];
  }, [allOrderedFields, groupByFieldKey, contributorAdditionalOnlyKeys, view]);

  /** Field keys still rendered inside the custom card grid (after campus / visibility stripped). */
  const mainCustomLayoutFieldKeys = useMemo(() => {
    const s = new Set<string>();
    for (const r of editorMainCustomRows) {
      for (const c of r) {
        if (c.type === "field") s.add(c.field.key);
      }
    }
    return s;
  }, [editorMainCustomRows]);

  /**
   * Main-editor fields not assigned a slot in custom card layout (e.g. editable helper columns).
   * Without this, custom-layout views would hide them from the main area entirely.
   */
  const inCardFieldsOutsideCustomLayout = useMemo(() => {
    const out: ResolvedFieldValue[] = [];
    const groupsSeen = new Set<string>();
    for (const f of inCardFields) {
      const group = groupByFieldKey.get(f.key);
      if (group) {
        if (groupsSeen.has(group.id)) continue;
        groupsSeen.add(group.id);
        if (!mainCustomLayoutFieldKeys.has(f.key)) out.push(f);
        continue;
      }
      if (!mainCustomLayoutFieldKeys.has(f.key)) out.push(f);
    }
    return out;
  }, [inCardFields, groupByFieldKey, mainCustomLayoutFieldKeys]);

  async function handleSave() {
    if (isSaving || isPending) return;
    if (!slug.trim()) {
      toast.addToast("Cannot save: missing public view address.", "error");
      return;
    }

    setIsSaving(true);
    setError(null);

    const isContactColumn = (colType: string) =>
      colType === "CONTACT_LIST" || colType === "MULTI_CONTACT_LIST";

    const redactedKeys = new Set(row.recordSuppression?.redactedFieldKeys ?? []);
    const cells: Array<{ columnId: number; value?: string; objectValue?: unknown }> = [
      ...editableFields
        .filter((field) => !redactedKeys.has(field.fieldKey))
        .map((field) => {
        const raw = formValues[field.columnId] ?? "";
        if (isContactColumn(field.columnType) && field.contactDisplayMode) {
          const objectValue = serializeContactDisplayToObjectValue(
            raw,
            field.columnType,
            field.contactDisplayMode,
          );
          if (objectValue === null) {
            return { columnId: field.columnId, value: "" };
          }
          return { columnId: field.columnId, objectValue };
        }
        return { columnId: field.columnId, value: raw };
      }),
      ...writableFieldGroups.flatMap((group) =>
        serializeMultiPersonToCells(groupValues[group.id] ?? [], group),
      ),
    ];

    try {
      const response = await fetch(`/api/public/views/${slug}/rows/${patchRowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          viewId: contributor?.viewId,
          cells,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Update failed.");
      }

      toast.addToast("Changes saved successfully.", "success");
      onCancel();
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Update failed.";
      setError(msg);
      toast.addToast(msg, "error");
    } finally {
      setIsSaving(false);
    }
  }

  function renderField(f: ResolvedFieldValue) {
    const group = groupByFieldKey.get(f.key);
    if (group) {
      if (group.readOnly) {
        return (
          <ContributorReadOnlyField
            key={`group-ro-${group.id}`}
            field={f}
            labelOverride={group.label}
            message="Read-only: multi-attribute delimited role data cannot be edited safely in this form."
          />
        );
      }
      return (
        <ContributorGroupFieldControl
          key={`group-${group.id}`}
          group={group}
          persons={groupValues[group.id] ?? []}
          onChange={(next) => setGroupValues((prev) => ({ ...prev, [group.id]: next }))}
        />
      );
    }

    const ed = editableByFieldKey.get(f.key);
    if (ed) {
      return (
        <ContributorSingleFieldControl
          key={f.key}
          field={f}
          editableDef={ed}
          value={formValues[ed.columnId] ?? ""}
          onChange={(val) => setFormValues(prev => ({ ...prev, [ed.columnId]: val }))}
        />
      );
    }

    return <ContributorReadOnlyField key={f.key} field={f} />;
  }

  const colCount = getCardLayoutColumnCount(view);
  const useAlignedGrid = colCount > 1;
  const gridStyle = useAlignedGrid ? customCardAlignedGridStyle(colCount) : undefined;
  const scrollWrap = customCardGridScrollWrapClassName(useAlignedGrid);

  return (
    <article
      className="scroll-mt-24 rounded-2xl border-2 border-[color:var(--wsu-crimson)] bg-[color:var(--wsu-paper)] p-4 shadow-xl sm:rounded-[1.75rem] sm:p-5"
      role="region"
      aria-label={`Editing row ${patchRowId}`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--wsu-border)] pb-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-[color:var(--wsu-ink)]">Editing Entry</h3>
          <p className="text-xs text-[color:var(--wsu-muted)]">Row {patchRowId} • Changes go live immediately.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-full border border-[color:var(--wsu-border)] bg-white px-4 py-1.5 text-sm font-medium text-[color:var(--wsu-muted)] hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isPending}
            className="rounded-full bg-[color:var(--wsu-crimson)] px-5 py-1.5 text-sm font-medium text-white hover:bg-[color:var(--wsu-crimson)]/90 disabled:opacity-50"
          >
            {isSaving || isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Main Area */}
        {hasCustomCardLayout(view) ? (
          <>
            {editorMainCustomRows.length > 0 ? (
              <div className="space-y-6">
                {editorMainCustomRows.map((cells, rowIndex) => {
                  const paddedCells = useAlignedGrid
                    ? [...cells.slice(0, colCount), ...Array(Math.max(0, colCount - cells.length)).fill({ type: "placeholder" as const })]
                    : cells;

                  const gridInner = (
                    <div className={useAlignedGrid ? "grid gap-4" : "space-y-6"} style={gridStyle}>
                      {useAlignedGrid ? (
                        <>
                          {paddedCells.map((cell, i) => (
                            <CardLayoutCellRenderer key={`h-${i}`} cell={cell} flexClass="min-w-0" mode="header" />
                          ))}
                          {paddedCells.map((cell, i) => {
                            const fieldKey = cell.type === "field" ? cell.field.key : null;
                            const ed = fieldKey ? editableByFieldKey.get(fieldKey) : null;
                            const group = fieldKey ? groupByFieldKey.get(fieldKey) : null;

                            return (
                              <CardLayoutCellRenderer
                                key={`edit-${i}`}
                                cell={cell}
                                flexClass="min-w-0"
                                mode="edit"
                                editProps={{
                                  editableDef: ed ?? undefined,
                                  group: group ?? undefined,
                                  value: ed ? formValues[ed.columnId] : undefined,
                                  persons: group ? groupValues[group.id] : undefined,
                                  onChangeValue: ed ? (val) => setFormValues(prev => ({ ...prev, [ed.columnId]: val })) : undefined,
                                  onChangePersons: group
                                    ? (next) => setGroupValues((prev) => ({ ...prev, [group.id]: next }))
                                    : undefined,
                                  suppressDuplicateTitle: true,
                                }}
                              />
                            );
                          })}
                        </>
                      ) : (
                        paddedCells.map((cell, i) => {
                          const fieldKey = cell.type === "field" ? cell.field.key : null;
                          const ed = fieldKey ? editableByFieldKey.get(fieldKey) : null;
                          const group = fieldKey ? groupByFieldKey.get(fieldKey) : null;

                          return (
                            <CardLayoutCellRenderer
                              key={i}
                              cell={cell}
                              flexClass="w-full"
                              mode="edit"
                              editProps={{
                                editableDef: ed ?? undefined,
                                group: group ?? undefined,
                                value: ed ? formValues[ed.columnId] : undefined,
                                persons: group ? groupValues[group.id] : undefined,
                                onChangeValue: ed ? (val) => setFormValues(prev => ({ ...prev, [ed.columnId]: val })) : undefined,
                                onChangePersons: group
                                  ? (next) => setGroupValues((prev) => ({ ...prev, [group.id]: next }))
                                  : undefined,
                              }}
                            />
                          );
                        })
                      )}
                    </div>
                  );

                  return (
                    <div
                      key={rowIndex}
                      className={cardLayoutContinuationRowClass(
                        paddedCells,
                        rowIndex,
                        rowIndex > 0 ? "border-t border-[color:var(--wsu-border)]/40 pt-6" : "",
                      )}
                    >
                      {scrollWrap ? <div className={scrollWrap}>{gridInner}</div> : gridInner}
                    </div>
                  );
                })}
              </div>
            ) : null}
            {inCardFieldsOutsideCustomLayout.length > 0 ? (
              <div
                className={`space-y-6 ${editorMainCustomRows.length > 0 ? "border-t border-[color:var(--wsu-border)]/40 pt-6" : ""}`}
              >
                {inCardFieldsOutsideCustomLayout.map(renderField)}
              </div>
            ) : null}
          </>
        ) : (
          <div className="space-y-6">{inCardFields.map(renderField)}</div>
        )}

        {/* Additional fields toggle */}
        {additionalFields.length > 0 && (
          <div className="border-t border-[color:var(--wsu-border)] pt-4">
            <button
              type="button"
              onClick={() => setShowAdditional(!showAdditional)}
              className="flex items-center gap-2 text-sm font-medium text-[color:var(--wsu-crimson)] hover:text-[color:var(--wsu-crimson)]/80"
              aria-expanded={showAdditional}
            >
              <svg
                className={`h-4 w-4 transition-transform ${showAdditional ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {showAdditional ? "Hide additional fields" : `Show ${additionalFields.length} additional field${additionalFields.length === 1 ? "" : "s"}`}
            </button>
            
            {showAdditional && (
              <div className="mt-6 space-y-6 border-l-2 border-[color:var(--wsu-stone)]/20 pl-4 transition-all animate-in fade-in slide-in-from-top-2 duration-200">
                <p className="text-xs text-[color:var(--wsu-muted)] italic">
                  Campus and Public Visibility (when this view includes them) — use the main editor above for program and contact fields.
                </p>
                {additionalFields.map(renderField)}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
