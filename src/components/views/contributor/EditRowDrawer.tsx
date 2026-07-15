"use client";

import { startTransition, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { getContributorEditRowHeading, getEditDrawerOrderedFields } from "@/components/views/layouts/layout-utils";
import {
  ContributorGroupFieldControl,
  ContributorReadOnlyField,
  ContributorSingleFieldControl,
} from "@/components/views/contributor/ContributorFieldControl";
import { useContributorContext } from "@/components/views/contributor/ContributorContext";
import type { EditableFieldGroup, ResolvedView, ResolvedViewRow } from "@/lib/config/types";
import type { ContributorEditableFieldDefinition } from "@/lib/contributor-utils";
import {
  contributorEditTargetRowId,
  parseMultiPersonRow,
  serializeContactDisplayToObjectValue,
  serializeMultiPersonToCells,
  type MultiPersonEntry,
} from "@/lib/contributor-utils";

export function EditRowDrawer({
  slug,
  view,
  row,
  open,
  onClose,
  returnFocusRef,
}: {
  slug: string;
  view: ResolvedView;
  row: ResolvedViewRow | null;
  open: boolean;
  onClose: () => void;
  returnFocusRef?: MutableRefObject<HTMLElement | null>;
}) {
  const router = useRouter();
  const toast = useToast();
  const contributor = useContributorContext();
  const [formValues, setFormValues] = useState<Record<number, string>>({});
  const [groupValues, setGroupValues] = useState<Record<string, MultiPersonEntry[]>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drawerSurfaceRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const editableFieldGroups = useMemo(
    () => contributor?.editingConfig?.editableFieldGroups ?? [],
    [contributor?.editingConfig?.editableFieldGroups],
  );
  const editableFields = useMemo(() => {
    if (!contributor?.editingConfig) {
      return [];
    }
    return contributor.editingConfig.editableFields;
  }, [contributor?.editingConfig]);

  const contributorFieldKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const f of contributor?.editingConfig?.editableFields ?? []) {
      keys.add(f.fieldKey);
    }
    for (const g of editableFieldGroups) {
      for (const a of g.attributes) {
        keys.add(a.fieldKey);
      }
    }
    for (const vf of view.fields) {
      if (vf.renderType === "people_group") {
        keys.add(vf.key);
      }
    }
    return keys;
  }, [contributor?.editingConfig?.editableFields, editableFieldGroups, view.fields]);

  const editableByFieldKey = useMemo(() => {
    const m = new Map<string, ContributorEditableFieldDefinition>();
    for (const f of editableFields) {
      m.set(f.fieldKey, f);
    }
    return m;
  }, [editableFields]);

  const orderedFields = useMemo(
    () => (row ? getEditDrawerOrderedFields(view, row, contributorFieldKeys, editableByFieldKey) : []),
    [view, row, contributorFieldKeys, editableByFieldKey],
  );

  const groupByFieldKey = useMemo(() => {
    const m = new Map<string, EditableFieldGroup>();
    for (const g of editableFieldGroups) {
      for (const a of g.attributes) {
        m.set(a.fieldKey, g);
      }
    }
    return m;
  }, [editableFieldGroups]);

  const writableFieldGroups = useMemo(
    () => editableFieldGroups.filter((g) => !g.readOnly),
    [editableFieldGroups],
  );

  const editDrawerTitle = useMemo(() => {
    if (!row) {
      return { visible: "Edit entry", srOnlySuffix: "" as string };
    }
    const heading = getContributorEditRowHeading(view, row);
    return {
      visible: heading ? `Edit: ${heading}` : "Edit your entry",
      srOnlySuffix: ` Smartsheet row ${row.id}`,
    };
  }, [view, row]);

  useEffect(() => {
    if (!row || !contributor?.editingConfig || !open) {
      return;
    }

    const nextValues = editableFields.reduce<Record<number, string>>((values, field) => {
      const text = row.fieldMap[field.fieldKey]?.textValue;
      values[field.columnId] = text ?? "";
      return values;
    }, {});
    setFormValues(nextValues);

    const nextGroups: Record<string, MultiPersonEntry[]> = {};
    for (const group of editableFieldGroups) {
      nextGroups[group.id] = parseMultiPersonRow(row, group);
    }
    setGroupValues(nextGroups);
    setError(null);
  }, [contributor?.editingConfig, editableFieldGroups, editableFields, open, row]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !contributor || !row) {
      return;
    }

    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const surface = drawerSurfaceRef.current;
    closeButtonRef.current?.focus();

    function cycleTabFocus(event: KeyboardEvent) {
      if (event.key !== "Tab" || !surface) {
        return;
      }
      const selector =
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const nodes = Array.from(surface.querySelectorAll(selector)).filter(
        (el): el is HTMLElement => el instanceof HTMLElement,
      );
      if (nodes.length === 0) {
        return;
      }
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", cycleTabFocus);
    return () => {
      document.removeEventListener("keydown", cycleTabFocus);
      const target = returnFocusRef?.current ?? previousActive;
      if (target && typeof target.focus === "function") {
        try {
          target.focus();
        } catch {
          /* ignore */
        }
      }
      if (returnFocusRef) {
        returnFocusRef.current = null;
      }
    };
  }, [open, contributor, row, returnFocusRef]);

  const dividerStyle = view.presentation?.rowDividerStyle ?? "default";
  const cardBorderClass =
    dividerStyle === "none"
      ? "border-0"
      : dividerStyle === "subtle"
        ? "border border-[color:var(--wsu-border)]/40"
        : "border border-[color:var(--wsu-border)]";

  if (!contributor || !open || !row) {
    return null;
  }

  const patchRowId = contributorEditTargetRowId(row, new Set(contributor.editableRowIds));

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!row || !contributor || isSaving) {
      return;
    }
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          viewId: contributor.viewId,
          cells,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; ok?: boolean } | null;
      if (!response.ok) {
        const nextError = payload?.error ?? "Update failed. Try again.";
        setError(nextError);
        toast.addToast(nextError, "error");
        return;
      }

      toast.addToast("Row updated.", "success");
      onClose();
      startTransition(() => {
        router.refresh();
      });
    } catch (submitError) {
      const nextError = submitError instanceof Error ? submitError.message : "Update failed. Try again.";
      setError(nextError);
      toast.addToast(nextError, "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[rgba(35,31,32,0.28)]" role="presentation">
      <aside
        ref={drawerSurfaceRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-row-drawer-title"
        className="flex h-full w-full max-w-xl flex-col border-l border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--wsu-border)] px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--wsu-crimson)]">
              Contributor Editing
            </p>
            <h3 id="edit-row-drawer-title" className="mt-2 text-2xl font-semibold text-[color:var(--wsu-ink)]">
              {editDrawerTitle.visible}
              <span className="sr-only">{editDrawerTitle.srOnlySuffix}</span>
            </h3>
            {contributor.isAdminUnrestrictedEditing ? (
              <p className="mt-2 text-sm text-[color:var(--wsu-muted)]">Administrator session — same fields as contributors; row contact rules do not apply.</p>
            ) : contributor.email ? (
              <p className="mt-2 text-sm text-[color:var(--wsu-muted)]">Signed in as {contributor.email}</p>
            ) : null}
            <p className="mt-2 text-xs text-[color:var(--wsu-muted)]">
              Use <strong className="font-medium text-[color:var(--wsu-ink)]">Close</strong> or{" "}
              <strong className="font-medium text-[color:var(--wsu-ink)]">Cancel</strong> to exit — clicking outside the panel
              does not close the editor, so you won’t lose edits by accident.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-full border border-[color:var(--wsu-border)] bg-white px-3 py-1.5 text-sm text-[color:var(--wsu-muted)]"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
            {editableFields.length === 0 && editableFieldGroups.length === 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                No editable fields are available for this row.
              </div>
            ) : (
              <article
                className={`rounded-[1.75rem] ${cardBorderClass} bg-[color:var(--wsu-paper)] p-5 shadow-[0_16px_40px_rgba(35,31,32,0.06)]`}
              >
                <p className="mb-4 text-xs leading-relaxed text-[color:var(--wsu-muted)]">
                  Fields appear in the <strong className="font-medium text-[color:var(--wsu-ink)]">same order as your public card</strong>.
                  <span className="text-[color:var(--wsu-ink)]"> White boxes with a border are editable</span>; plain text blocks
                  are read-only. Changes save to Smartsheet. For a single contact column, use{" "}
                  <strong className="font-medium text-[color:var(--wsu-ink)]">Clear this role</strong>.
                </p>
                <div className="space-y-4">
                  {(() => {
                    const groupsRendered = new Set<string>();
                    return orderedFields.map((field) => {
                      const group = groupByFieldKey.get(field.key);
                      if (group) {
                        if (groupsRendered.has(group.id)) {
                          return null;
                        }
                        groupsRendered.add(group.id);
                        if (group.readOnly) {
                          const rf = group.fromRoleGroupViewFieldKey
                            ? row.fieldMap[group.fromRoleGroupViewFieldKey]
                            : undefined;
                          return (
                            <div
                              key={`group-ro-${group.id}`}
                              className="border-b border-[color:var(--wsu-border)]/50 pb-4 last:border-0 last:pb-0"
                            >
                              <ContributorReadOnlyField
                                field={rf || { ...field, textValue: "", listValue: [], links: [], isEmpty: true }}
                                labelOverride={group.label}
                                message="Read-only: multi-attribute delimited role data cannot be edited safely in this form."
                              />
                            </div>
                          );
                        }
                        return (
                          <div key={`group-${group.id}`} className="border-b border-[color:var(--wsu-border)]/50 pb-4 last:border-0 last:pb-0">
                            <ContributorGroupFieldControl
                              group={group}
                              persons={groupValues[group.id] ?? []}
                              onChange={(next) => setGroupValues((prev) => ({ ...prev, [group.id]: next }))}
                            />
                          </div>
                        );
                      }

                      const ed = editableByFieldKey.get(field.key);
                      if (ed) {
                        return (
                          <div key={field.key} className="border-b border-[color:var(--wsu-border)]/50 pb-4 last:border-0 last:pb-0">
                            <ContributorSingleFieldControl
                              field={field}
                              editableDef={ed}
                              value={formValues[ed.columnId] ?? ""}
                              onChange={(val) => setFormValues((current) => ({ ...current, [ed.columnId]: val }))}
                            />
                          </div>
                        );
                      }

                      return (
                        <div key={field.key} className="border-b border-[color:var(--wsu-border)]/50 pb-4 last:border-0 last:pb-0">
                          <ContributorReadOnlyField field={field} />
                        </div>
                      );
                    });
                  })()}
                </div>
              </article>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
              >
                {error}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[color:var(--wsu-border)] px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[color:var(--wsu-border)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--wsu-muted)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || (editableFields.length === 0 && writableFieldGroups.length === 0)}
              className="rounded-full bg-[color:var(--wsu-crimson)] px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
