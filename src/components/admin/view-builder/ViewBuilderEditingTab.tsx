"use client";

import type { ViewConfig, ViewEditingConfig, SmartsheetColumn } from "@/lib/config/types";
import type { SmartsheetSchemaSummary } from "@/lib/smartsheet";
import { getEligibleEditableFieldDefinitions, getFieldsForMultiPersonGroup } from "@/lib/contributor-utils";
import { createEditingConfigState, toggleNumberSelection } from "./view-builder-utils";

type EligibleEditableField = ReturnType<typeof getEligibleEditableFieldDefinitions>[number];
type MultiPersonField = ReturnType<typeof getFieldsForMultiPersonGroup>[number];

export function ViewBuilderEditingTab({
  view,
  updateEditing,
  fetchSchema,
  schema,
  schemaError,
  schemaLoading,
  contactColumns,
  eligibleEditableFields,
  fieldsForMultiPersonGroup,
  invalidContactColumnIds,
  invalidEditableColumnIds,
}: {
  view: ViewConfig;
  updateEditing: (nextEditing: ViewEditingConfig | undefined) => void;
  fetchSchema: () => Promise<void>;
  schema: SmartsheetSchemaSummary | null;
  schemaError: string;
  schemaLoading: boolean;
  contactColumns: SmartsheetColumn[];
  eligibleEditableFields: EligibleEditableField[];
  fieldsForMultiPersonGroup: MultiPersonField[];
  invalidContactColumnIds: number[];
  invalidEditableColumnIds: number[];
}) {
  return (
    <div id="tabpanel-editing" role="tabpanel" aria-labelledby="tab-editing" className="mt-6 space-y-6">
            <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-[color:var(--wsu-ink)]">Contributor editing</h2>
                  <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">
                    Enable row-level editing for contributors who appear in the configured contact columns.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void fetchSchema()}
                  disabled={schemaLoading || !view.sourceId}
                  className="rounded-full border border-[color:var(--wsu-border)] bg-white px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {schemaLoading ? "Loading schema..." : schema ? "Refresh schema" : "Load schema"}
                </button>
              </div>

              {schemaError && (
                <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {schemaError}
                </p>
              )}

              {!schema ? (
                <p className="mt-6 text-sm text-[color:var(--wsu-muted)]">
                  Load the source schema to configure contact columns and eligible editable fields.
                </p>
              ) : (
                <div className="mt-6 space-y-6">
                  <label className="flex items-start gap-3 rounded-2xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/10 p-4">
                    <input
                      type="checkbox"
                      checked={view.editing?.enabled ?? false}
                      onChange={(event) =>
                        updateEditing({
                          ...createEditingConfigState(view.editing),
                          enabled: event.target.checked,
                        })
                      }
                      className="mt-1 rounded border-[color:var(--wsu-border)]"
                    />
                    <div>
                      <p className="text-sm font-medium text-[color:var(--wsu-ink)]">Enable contributor editing</p>
                      <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">
                        Contributors can edit only rows where their `@wsu.edu` email appears in one of the selected contact columns.
                      </p>
                    </div>
                  </label>

                  {view.editing?.enabled && (
                    <>
                      <section className="rounded-2xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/10 p-5">
                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">
                            Public Login Link
                          </h3>
                          <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">
                            Control whether the public page shows a contributor sign-in link for this view.
                          </p>
                        </div>
                        <label className="mt-4 flex items-start gap-3 rounded-xl border border-[color:var(--wsu-border)] bg-white p-4">
                          <input
                            type="checkbox"
                            checked={view.editing.showLoginLink !== false}
                            onChange={(event) =>
                              updateEditing({
                                ...createEditingConfigState(view.editing),
                                enabled: true,
                                showLoginLink: event.target.checked,
                              })
                            }
                            className="mt-1 rounded border-[color:var(--wsu-border)]"
                          />
                          <div>
                            <p className="text-sm font-medium text-[color:var(--wsu-ink)]">Show contributor login link on the public page</p>
                            <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">
                              When hidden, contributor editing still works for direct login URLs and existing signed-in contributors.
                            </p>
                          </div>
                        </label>
                        <label className="mt-4 flex items-start gap-3 rounded-xl border border-[color:var(--wsu-border)] bg-white p-4">
                          <input
                            type="checkbox"
                            checked={view.editing.showContributorInstructions !== false}
                            onChange={(event) =>
                              updateEditing({
                                ...createEditingConfigState(view.editing),
                                enabled: true,
                                showContributorInstructions: event.target.checked,
                              })
                            }
                            className="mt-1 rounded border-[color:var(--wsu-border)]"
                          />
                          <div>
                            <p className="text-sm font-medium text-[color:var(--wsu-ink)]">
                              Show contributor instructions link on the public page
                            </p>
                            <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">
                              Adds a single link that opens the help guide in a <strong>new window</strong>. Nothing expands on the
                              page itself. The guide is public—no password to read it. Turn off for a minimal page.
                            </p>
                          </div>
                        </label>
                      </section>

                      <div className="grid gap-6 lg:grid-cols-2">
                        <section className="space-y-4 rounded-2xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/10 p-5">
                          <div>
                            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">
                              Contact Columns
                            </h3>
                            <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">
                              Any matching contact in these columns grants row edit access. <strong>You must also select Editable Fields or add a Multi-person group below</strong> — contact columns define who can edit, not what.
                            </p>
                          </div>
                          <div className="space-y-3">
                            {contactColumns.length === 0 ? (
                              <p className="text-sm text-[color:var(--wsu-muted)]">
                                No CONTACT_LIST or MULTI_CONTACT_LIST columns are available in this source.
                              </p>
                            ) : (
                              contactColumns.map((column) => {
                                const checked = view.editing?.contactColumnIds.includes(column.id) ?? false;
                                return (
                                  <label
                                    key={column.id}
                                    className="flex items-start gap-3 rounded-xl border border-[color:var(--wsu-border)] bg-white p-3"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(event) =>
                                        updateEditing({
                                          ...createEditingConfigState(view.editing),
                                          enabled: true,
                                          contactColumnIds: toggleNumberSelection(
                                            view.editing?.contactColumnIds ?? [],
                                            column.id,
                                            event.target.checked,
                                          ),
                                        })
                                      }
                                      className="mt-1 rounded border-[color:var(--wsu-border)]"
                                    />
                                    <div>
                                      <p className="text-sm font-medium text-[color:var(--wsu-ink)]">{column.title}</p>
                                      <p className="text-xs text-[color:var(--wsu-muted)]">{column.type}</p>
                                    </div>
                                  </label>
                                );
                              })
                            )}
                          </div>
                        </section>

                        <section className="space-y-4 rounded-2xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/10 p-5">
                          <div>
                            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">
                              Editable Fields
                            </h3>
                            <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">
                              Select which columns contributors can edit. <strong>At least one is required.</strong> Eligible: visible direct-mapped TEXT_NUMBER, PICKLIST, PHONE (no transforms), and CONTACT_LIST/MULTI_CONTACT_LIST (with contact_emails or contact_names transform).
                            </p>
                          </div>
                          <div className="space-y-3">
                            {eligibleEditableFields.length === 0 ? (
                              <p className="text-sm text-[color:var(--wsu-muted)]">
                                No eligible editable fields. In the <strong>Fields</strong> tab, add a visible TEXT_NUMBER, PICKLIST, PHONE, or CONTACT_LIST/MULTI_CONTACT_LIST field (contact columns need contact_emails or contact_names transform) with direct column mapping. Or use <strong>Multi-person field groups</strong> below for comma-separated columns (e.g. coordinator names, emails).
                              </p>
                            ) : (
                              eligibleEditableFields.map((field) => {
                                const checked = view.editing?.editableColumnIds.includes(field.columnId) ?? false;
                                return (
                                  <label
                                    key={field.columnId}
                                    className="flex items-start gap-3 rounded-xl border border-[color:var(--wsu-border)] bg-white p-3"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(event) =>
                                        updateEditing({
                                          ...createEditingConfigState(view.editing),
                                          enabled: true,
                                          editableColumnIds: toggleNumberSelection(
                                            view.editing?.editableColumnIds ?? [],
                                            field.columnId,
                                            event.target.checked,
                                          ),
                                        })
                                      }
                                      className="mt-1 rounded border-[color:var(--wsu-border)]"
                                    />
                                    <div>
                                      <p className="text-sm font-medium text-[color:var(--wsu-ink)]">{field.label}</p>
                                      <p className="text-xs text-[color:var(--wsu-muted)]">
                                        Column {field.columnId} · {field.columnType} · render {field.renderType}
                                      </p>
                                    </div>
                                  </label>
                                );
                              })
                            )}
                          </div>
                        </section>

                        <section className="space-y-4 rounded-2xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/10 p-5">
                          <div>
                            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">
                              Multi-person field groups
                            </h3>
                            <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">
                              For columns like &quot;Coordinator&quot; and &quot;Coordinator email&quot; that hold comma-separated values. Contributors edit one card per person; values save comma-separated. Uses a broader field list than Editable Fields — if that section is empty, you can still add a group here.
                            </p>
                          </div>
                          <div className="space-y-4">
                            {(view.editing?.editableFieldGroups ?? []).map((group, groupIdx) => (
                              <div
                                key={group.id}
                                className="rounded-xl border border-[color:var(--wsu-border)] bg-white p-4 space-y-3"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <input
                                    type="text"
                                    value={group.label}
                                    onChange={(e) => {
                                      const next = [...(view.editing?.editableFieldGroups ?? [])];
                                      next[groupIdx] = { ...next[groupIdx]!, label: e.target.value };
                                      updateEditing({ ...createEditingConfigState(view.editing), enabled: true, editableFieldGroups: next });
                                    }}
                                    placeholder="Group label (e.g. Grad program coordinators)"
                                    className="flex-1 rounded-lg border border-[color:var(--wsu-border)] px-3 py-2 text-sm"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = (view.editing?.editableFieldGroups ?? []).filter((_, i) => i !== groupIdx);
                                      updateEditing({ ...createEditingConfigState(view.editing), enabled: true, editableFieldGroups: next });
                                    }}
                                    className="rounded-full border border-rose-200 px-3 py-1.5 text-xs text-rose-700"
                                  >
                                    Remove
                                  </button>
                                </div>
                                <div className="grid gap-2 text-sm">
                                  {(["name", "email", "phone"] as const).map((attr) => {
                                    const current = group.attributes.find((a) => a.attribute === attr);
                                    return (
                                      <div key={attr} className="flex items-center gap-2">
                                        <span className="w-14 shrink-0 capitalize text-[color:var(--wsu-muted)]">{attr}:</span>
                                        <select
                                          value={current?.fieldKey ?? ""}
                                          onChange={(e) => {
                                            const fieldKey = e.target.value;
                                            const mpField = (fieldsForMultiPersonGroup.length > 0 ? fieldsForMultiPersonGroup : eligibleEditableFields).find((f) => f.fieldKey === fieldKey);
                                            const columnId = mpField?.columnId ?? 0;
                                            const columnType = mpField && "columnType" in mpField ? mpField.columnType : undefined;
                                            const next = [...(view.editing?.editableFieldGroups ?? [])];
                                            const attrs = [...(next[groupIdx]?.attributes ?? [])];
                                            const existingIdx = attrs.findIndex((a) => a.attribute === attr);
                                            const newAttr = { attribute: attr, fieldKey: fieldKey || "", columnId, columnType };
                                            if (existingIdx >= 0) {
                                              attrs[existingIdx] = newAttr;
                                            } else {
                                              attrs.push(newAttr);
                                            }
                                            next[groupIdx] = { ...next[groupIdx]!, attributes: attrs };
                                            updateEditing({ ...createEditingConfigState(view.editing), enabled: true, editableFieldGroups: next });
                                          }}
                                          className="flex-1 rounded-lg border border-[color:var(--wsu-border)] px-2 py-1.5 text-sm"
                                        >
                                          <option value="">— Select field —</option>
                                          {(fieldsForMultiPersonGroup.length > 0 ? fieldsForMultiPersonGroup : eligibleEditableFields).map((f) => (
                                            <option key={`${f.fieldKey}-${f.columnId}`} value={f.fieldKey}>
                                              {f.label}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...(view.editing?.editableFieldGroups ?? []), { id: `group-${Date.now()}`, label: "New group", attributes: [] }];
                                updateEditing({ ...createEditingConfigState(view.editing), enabled: true, editableFieldGroups: next });
                              }}
                              className="w-full rounded-xl border border-dashed border-[color:var(--wsu-border)] py-2 text-sm font-medium text-[color:var(--wsu-muted)] hover:bg-white"
                            >
                              Add multi-person group
                            </button>
                          </div>
                        </section>
                      </div>

                      {view.editing?.enabled &&
                        (view.editing.editableColumnIds?.length ?? 0) === 0 &&
                        (view.editing.editableFieldGroups?.length ?? 0) === 0 && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                          <p className="font-semibold">Select what contributors can edit</p>
                          <p className="mt-1">
                            Contact columns define <em>who</em> can edit. You must also select at least one <strong>Editable Field</strong> or add a <strong>Multi-person field group</strong> to define <em>what</em> they can edit.
                          </p>
                        </div>
                      )}

                      {(invalidContactColumnIds.length > 0 || invalidEditableColumnIds.length > 0) && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                          <p className="font-semibold">Current selections need attention</p>
                          {invalidContactColumnIds.length > 0 && (
                            <p className="mt-2">
                              Contact columns no longer valid: {invalidContactColumnIds.join(", ")}.
                            </p>
                          )}
                          {invalidEditableColumnIds.length > 0 && (
                            <p className="mt-2">
                              Editable columns no longer eligible: {invalidEditableColumnIds.join(", ")}.
                            </p>
                          )}
                        </div>
                      )}

                      <div className="rounded-xl border border-[color:var(--wsu-border)] bg-white px-4 py-4 text-sm text-[color:var(--wsu-muted)]">
                        <p>
                          <span className="font-semibold text-[color:var(--wsu-ink)]">Selected contact columns:</span>{" "}
                          {view.editing.contactColumnIds.length}
                        </p>
                        <p className="mt-2">
                          <span className="font-semibold text-[color:var(--wsu-ink)]">Selected editable columns:</span>{" "}
                          {view.editing.editableColumnIds.length}
                        </p>
                        <p className="mt-2">
                          Save-time validation will re-check these selections against the live schema.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
    </div>
  );
}
