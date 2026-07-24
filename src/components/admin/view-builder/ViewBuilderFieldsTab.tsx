"use client";

import {
  FIELD_TEXT_STYLE_VALUES,
} from "@/lib/config/types";
import { TRANSFORM_OPTIONS, RENDER_TYPE_OPTIONS, PEOPLE_STYLE_OPTIONS } from "@/lib/config/options";
import { isRoleGroupFieldSource } from "@/lib/role-groups";
import type {
  FieldTextStyle,
  RenderType,
  SmartsheetColumn,
  SourceConfig,
  ViewConfig,
  ViewFieldConfig,
  ViewFieldSource,
} from "@/lib/config/types";
import type { ResolvedView } from "@/lib/config/types";
import type { SmartsheetSchemaSummary } from "@/lib/smartsheet";
import { ViewBuilderLivePreview } from "./ViewBuilderLivePreview";
import { type RoleGroupOverlapWarning } from "./view-builder-utils";

export function ViewBuilderFieldsTab({
  view,
  update,
  updateField,
  moveField,
  activeSource,
  schema,
  schemaError,
  schemaLoading,
  fetchSchema,
  toggleColumnIncluded,
  setSchemaColumnsIncluded,
  isColumnIncluded,
  getFieldForColumn,
  addRoleGroupFieldToView,
  roleGroupOverlapWarnings,
  roleGroupOverlapByFieldKey,
  sourceMap,
  livePreview,
  livePreviewLoading,
  livePreviewError,
}: {
  view: ViewConfig;
  update: <K extends keyof ViewConfig>(key: K, value: ViewConfig[K]) => void;
  updateField: (index: number, nextField: ViewFieldConfig) => void;
  moveField: (fromIndex: number, direction: "up" | "down") => void;
  activeSource: SourceConfig | undefined;
  schema: SmartsheetSchemaSummary | null;
  schemaError: string;
  schemaLoading: boolean;
  fetchSchema: () => Promise<void>;
  toggleColumnIncluded: (col: SmartsheetColumn) => void;
  setSchemaColumnsIncluded: (include: boolean) => void;
  isColumnIncluded: (col: SmartsheetColumn) => boolean;
  getFieldForColumn: (col: SmartsheetColumn) => ViewFieldConfig | undefined;
  addRoleGroupFieldToView: (roleGroupId: string) => void;
  roleGroupOverlapWarnings: RoleGroupOverlapWarning[];
  roleGroupOverlapByFieldKey: Map<string, RoleGroupOverlapWarning>;
  sourceMap: Map<string, string>;
  livePreview: { resolvedView: ResolvedView; warnings: string[] } | null;
  livePreviewLoading: boolean;
  livePreviewError: string | null;
}) {
  const includedCount = schema
    ? schema.columns.filter((col) => isColumnIncluded(col)).length
    : 0;
  const totalColumns = schema?.columns.length ?? 0;
  const allSelected = totalColumns > 0 && includedCount === totalColumns;
  const someSelected = includedCount > 0 && includedCount < totalColumns;
  return (
    <div id="tabpanel-fields" role="tabpanel" aria-labelledby="tab-fields" className="mt-6 space-y-6">
            <div className="rounded-xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/20 px-4 py-3 text-sm text-[color:var(--wsu-muted)]">
              <p className="font-medium text-[color:var(--wsu-ink)]">Steps:</p>
              <ol className="mt-1 list-decimal list-inside space-y-1">
                <li>Select a source in Setup, then click <strong>Load columns</strong> below.</li>
                <li>Check each column you want in the view; edit display names as needed.</li>
                <li>Use the Arrange section to reorder fields (up/down) or remove ones you don&apos;t need.</li>
                <li>Switch to Preview to see the result.</li>
              </ol>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[color:var(--wsu-ink)]">Columns & display names</h2>
              <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">Load columns from the source, then select which to include and set their display names.</p>
              {view.presentation?.hideCampusFieldInRecordDisplay && view.presentation?.campusFieldKey && (
                <p className="mt-2 text-xs text-[color:var(--wsu-muted)]">
                  Note: <strong>Hide campus column from records</strong> only hides that field on the <em>public</em> card body. The campus column still appears below so you can include it, set its key/label, and use it for grouping, merge, and chips.
                </p>
              )}
            </div>
        {!view.sourceId ? (
          <p className="mt-4 text-sm text-[color:var(--wsu-muted)]">Select a source above, then load columns.</p>
        ) : (
          <>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => void fetchSchema()}
                disabled={schemaLoading}
                className="rounded-full border border-[color:var(--wsu-border)] bg-white px-4 py-2 text-sm font-medium hover:border-[color:var(--wsu-crimson)] disabled:opacity-50"
              >
                {schemaLoading ? "Loading…" : schema ? "Reload columns" : "Load columns"}
              </button>
              {schema && (
                <span className="text-sm text-[color:var(--wsu-muted)]">
                  {schema.columns.length} columns from {schema.name}
                </span>
              )}
            </div>
            {schemaError && (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{schemaError}</p>
            )}
            {schema && (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[color:var(--wsu-ink)]">
                    Select columns to include and edit display names:
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-[color:var(--wsu-muted)]">
                      {includedCount} of {totalColumns} selected
                    </span>
                    <button
                      type="button"
                      onClick={() => setSchemaColumnsIncluded(true)}
                      disabled={allSelected}
                      className="rounded-full border border-[color:var(--wsu-border)] bg-white px-3 py-1.5 text-xs font-medium hover:border-[color:var(--wsu-crimson)] disabled:opacity-40"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setSchemaColumnsIncluded(false)}
                      disabled={includedCount === 0}
                      className="rounded-full border border-[color:var(--wsu-border)] bg-white px-3 py-1.5 text-xs font-medium hover:border-[color:var(--wsu-crimson)] disabled:opacity-40"
                    >
                      Clear all
                    </button>
                  </div>
                </div>
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-[color:var(--wsu-border)] bg-white p-4">
                  <label className="sticky top-0 z-10 -mx-1 mb-2 flex min-h-[44px] items-center gap-2 border-b border-[color:var(--wsu-border)] bg-white px-1 pb-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      onChange={() => setSchemaColumnsIncluded(!allSelected)}
                      className="rounded border-[color:var(--wsu-border)]"
                      aria-label={allSelected ? "Clear all columns" : "Select all columns"}
                    />
                    <span className="text-sm font-medium text-[color:var(--wsu-ink)]">
                      {allSelected ? "Deselect all columns" : "Select all columns"}
                    </span>
                  </label>
                  {schema.columns.map((col) => {
                    const included = isColumnIncluded(col);
                    const field = getFieldForColumn(col);
                    return (
                      <div key={col.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[color:var(--wsu-border)]/60 bg-[color:var(--wsu-stone)]/20 p-3">
                        <label className="flex min-h-[44px] items-center gap-2">
                          <input
                            type="checkbox"
                            checked={included}
                            onChange={() => toggleColumnIncluded(col)}
                            className="rounded border-[color:var(--wsu-border)]"
                          />
                          <span className="text-sm font-medium text-[color:var(--wsu-ink)]">{col.title}</span>
                          <span className="rounded bg-[color:var(--wsu-stone)]/40 px-1.5 py-0.5 text-[10px] font-mono text-[color:var(--wsu-muted)]" title="Smartsheet column type">
                            {col.type ?? "TEXT_NUMBER"}
                          </span>
                        </label>
                        {included && (
                          <div className="flex flex-1 items-center gap-2 min-w-0">
                            <span className="text-sm text-[color:var(--wsu-muted)]">Display name:</span>
                            <input
                              value={field?.label ?? col.title}
                              onChange={(event) => {
                                const nextLabel = event.target.value;
                                const idx = view.fields.findIndex(
                                  (f) =>
                                    !isRoleGroupFieldSource(f.source) &&
                                    (f.source.columnTitle === col.title || f.source.columnId === col.id),
                                );
                                if (idx >= 0 && view.fields[idx]) {
                                  updateField(idx, { ...view.fields[idx], label: nextLabel });
                                }
                              }}
                              placeholder={col.title}
                              className="min-w-0 flex-1 rounded-xl border border-[color:var(--wsu-border)] px-3 py-2 text-sm"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

            <div className="mt-6">
              <h2 className="text-xl font-semibold text-[color:var(--wsu-ink)]">Arrange</h2>
              <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">Reorder columns for display. Order here = display order in the view.</p>
              {["cards", "list", "stacked", "accordion", "tabbed", "list_detail"].includes(view.layout) && (
                <p className="mt-2 text-sm text-[color:var(--wsu-muted)]">
                  To control field layout <em>within</em> each card (rows, side-by-side), go to <strong>Setup</strong> → <strong>Custom card layout</strong> and enable it.
                </p>
              )}
              {roleGroupOverlapWarnings.length > 0 && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <p className="font-semibold text-amber-950">Possible duplicate grouped-role content in preview</p>
                  <ul className="mt-2 space-y-1">
                    {roleGroupOverlapWarnings.map((warning) => (
                      <li key={warning.roleFieldKey}>
                        <strong>{warning.roleFieldLabel}</strong> overlaps raw fields{" "}
                        {warning.overlappingFields.map((field) => field.label).join(", ")}. Remove the raw fields if you
                        want one grouped header without duplicated names or contact lines.
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-4 space-y-3">
          {view.fields.length === 0 ? (
            <p className="text-sm text-[color:var(--wsu-muted)]">Select columns above to add them here, then reorder.</p>
          ) : (
            view.fields
              .map((field, index) => ({ field, index }))
              .map(({ field, index }) => {
              const rgSrc = isRoleGroupFieldSource(field.source) ? field.source : null;
              const colSource = (rgSrc ? null : field.source) as ViewFieldSource | null;
              const overlapWarning = roleGroupOverlapByFieldKey.get(field.key);
              const isUnmapped = Boolean(colSource && !colSource.columnId && !colSource.columnTitle);
              return (
              <div
                key={`${field.key}-${index}`}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${
                  isUnmapped ? "border-amber-400 bg-amber-50/50" : "border-[color:var(--wsu-border)] bg-white"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <input
                      value={field.label}
                      onChange={(e) => updateField(index, { ...field, label: e.target.value })}
                      placeholder={field.key || "Display name"}
                      className="min-w-0 flex-1 rounded-xl border border-[color:var(--wsu-border)] bg-white px-3 py-1.5 text-sm font-medium"
                    />
                  </div>
                  <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">
                    {rgSrc ? (
                      <>
                        Role group:{" "}
                        <span className="font-mono text-[color:var(--wsu-ink)]">{rgSrc.roleGroupId}</span>
                        {activeSource?.roleGroups?.find((g) => g.id === rgSrc.roleGroupId)
                          ?.mode === "delimited_parallel" && (
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                            Delimited role group
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        Smartsheet:{" "}
                        {colSource?.columnTitle ?? colSource?.columnId ?? (isUnmapped ? "—" : "—")}
                        {isUnmapped && (
                          <span className="ml-2 text-amber-600 font-medium">Map this field to a column</span>
                        )}
                        {colSource?.columnType && (
                          <span className="ml-1.5 rounded bg-[color:var(--wsu-stone)]/40 px-1.5 py-0.5 text-[10px] font-mono">
                            {colSource.columnType}
                          </span>
                        )}
                      </>
                    )}
                  </p>
                  {!rgSrc &&
                    view.presentation?.hideCampusFieldInRecordDisplay === true &&
                    view.presentation?.campusFieldKey === field.key && (
                      <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">
                        <span className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 font-medium text-sky-900">
                          Campus (public)
                        </span>{" "}
                        Omitted from each card&apos;s body; chips / grouping / merge still use this field.
                      </p>
                    )}
                  {overlapWarning && (
                    <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      This grouped role field overlaps raw fields still included in the view:{" "}
                      {overlapWarning.overlappingFields.map((overlappingField) => overlappingField.label).join(", ")}.
                      Remove the raw fields if you want one grouped block in preview.
                    </p>
                  )}
                  {rgSrc && activeSource?.roleGroups?.length ? (
                    <label className="mt-2 flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-[color:var(--wsu-muted)]">
                      <span>Linked role group</span>
                      <select
                        value={rgSrc.roleGroupId}
                        onChange={(e) => {
                          const id = e.target.value;
                          const rg = activeSource.roleGroups?.find((g) => g.id === id);
                          updateField(index, {
                            ...field,
                            label: rg?.defaultDisplayLabel ?? rg?.label ?? field.label,
                            source: { kind: "role_group", roleGroupId: id },
                            transforms: [],
                            render: { ...field.render, type: "people_group", listDisplay: field.render.listDisplay ?? "inline", peopleStyle: field.render.peopleStyle ?? "plain" },
                          });
                        }}
                        className="max-w-md rounded-xl border border-[color:var(--wsu-border)] bg-white px-3 py-1.5 text-xs font-medium"
                      >
                        {activeSource.roleGroups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.label} ({g.id})
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--wsu-muted)]">
                      <span>Render as</span>
                      {rgSrc ? (
                        <p className="rounded-xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/30 px-3 py-2 text-xs font-medium text-[color:var(--wsu-ink)]">
                          People group (fixed for role group fields)
                        </p>
                      ) : (
                        <select
                          value={field.render.type}
                          onChange={(e) => updateField(index, { ...field, render: { ...field.render, type: e.target.value as RenderType } })}
                          className="w-full rounded-xl border border-[color:var(--wsu-border)] bg-white px-3 py-1.5 text-xs font-medium focus:border-[color:var(--wsu-crimson)] focus:outline-none"
                        >
                          {RENDER_TYPE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt.replace(/_/g, " ")}</option>
                          ))}
                        </select>
                      )}
                    </label>
                    {(["list", "mailto_list", "phone_list", "people_group"].includes(field.render.type) ||
                      (field.render.type === "text" && field.transforms?.some((t) => t.op === "split"))) && (
                      <>
                        <label className="space-y-1.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--wsu-muted)]">
                          <span>{field.render.type === "people_group" ? "People layout" : "List display"}</span>
                          <select
                            value={field.render.listDisplay ?? (field.render.type === "people_group" ? "inline" : "stacked")}
                            onChange={(e) => updateField(index, { ...field, render: { ...field.render, listDisplay: (e.target.value || undefined) as "inline" | "stacked" | undefined } })}
                            className="w-full rounded-xl border border-[color:var(--wsu-border)] bg-white px-3 py-1.5 text-xs font-medium focus:border-[color:var(--wsu-crimson)] focus:outline-none"
                          >
                            <option value="stacked">{field.render.type === "people_group" ? "Vertical (one person per block)" : "Stacked (each on own row)"}</option>
                            <option value="inline">{field.render.type === "people_group" ? "Horizontal (wrap across row)" : "Inline (delimiter between)"}</option>
                          </select>
                        </label>
                        {field.render.type === "people_group" && (
                          <label className="space-y-1.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--wsu-muted)]">
                            <span>People style</span>
                            <select
                              value={field.render.peopleStyle ?? "plain"}
                              onChange={(e) => updateField(index, { ...field, render: { ...field.render, peopleStyle: (e.target.value || "plain") as "plain" | "capsule" } })}
                              className="w-full rounded-xl border border-[color:var(--wsu-border)] bg-white px-3 py-1.5 text-xs font-medium focus:border-[color:var(--wsu-crimson)] focus:outline-none"
                            >
                              {PEOPLE_STYLE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </label>
                        )}
                        {field.render.listDisplay === "inline" && field.render.type !== "people_group" && (
                          <label className="space-y-1.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--wsu-muted)]">
                            <span>Delimiter</span>
                            <input
                              type="text"
                              value={field.render.listDelimiter ?? ", "}
                              onChange={(e) => updateField(index, { ...field, render: { ...field.render, listDelimiter: e.target.value || undefined } })}
                              placeholder=", "
                              className="w-full rounded-xl border border-[color:var(--wsu-border)] bg-white px-3 py-1.5 text-xs font-medium focus:border-[color:var(--wsu-crimson)] focus:outline-none"
                            />
                          </label>
                        )}
                      </>
                    )}
                    {!rgSrc ? (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--wsu-muted)]">Transforms</span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {field.transforms?.map((t, ti) => (
                            <span key={ti} className="group relative flex items-center gap-1 rounded-full bg-[color:var(--wsu-stone)]/40 px-2 py-0.5 text-[10px] font-medium text-[color:var(--wsu-muted)]">
                              {t.op}
                              {t.op === "split" && (
                                <input
                                  type="text"
                                  value={t.delimiter ?? ","}
                                  onChange={(e) => {
                                    const next = [...(field.transforms ?? [])];
                                    next[ti] = { ...t, delimiter: e.target.value || undefined };
                                    updateField(index, { ...field, transforms: next });
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-10 min-w-0 rounded border-0 bg-white/60 px-1 py-0 text-[10px] focus:ring-1"
                                  placeholder=","
                                  title="Delimiter (e.g. comma)"
                                />
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...(field.transforms ?? [])];
                                  next.splice(ti, 1);
                                  updateField(index, { ...field, transforms: next });
                                }}
                                className="text-[color:var(--wsu-muted)] hover:text-rose-600"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          <select
                            value=""
                            onChange={(e) => {
                              if (!e.target.value) return;
                              const op = e.target.value;
                              const newTransform = op === "split" ? { op: "split", delimiter: "," } : { op };
                              const next = [...(field.transforms ?? []), newTransform];
                              updateField(index, { ...field, transforms: next });
                              e.target.value = "";
                            }}
                            className="rounded-full border border-[color:var(--wsu-border)] bg-white px-2 py-0.5 text-[10px] font-medium"
                          >
                            <option value="">+ Add</option>
                            {TRANSFORM_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>{opt.replace(/_/g, " ")}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--wsu-muted)]">
                      <span>Value typography</span>
                      <select
                        value={field.render.textStyle ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateField(index, {
                            ...field,
                            render: {
                              ...field.render,
                              textStyle: v === "" ? undefined : (v as FieldTextStyle),
                            },
                          });
                        }}
                        className="w-full rounded-xl border border-[color:var(--wsu-border)] bg-white px-3 py-1.5 text-xs font-medium focus:border-[color:var(--wsu-crimson)] focus:outline-none"
                      >
                        <option value="">Default (theme body)</option>
                        {FIELD_TEXT_STYLE_VALUES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <p className="font-normal normal-case text-[color:var(--wsu-muted)]">Optional per-cell value scale (mixed layouts).</p>
                    </label>
                    <label className="space-y-1.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--wsu-muted)]">
                      <span>Label typography</span>
                      <select
                        value={field.render.labelStyle ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateField(index, {
                            ...field,
                            render: {
                              ...field.render,
                              labelStyle: v === "" ? undefined : (v as FieldTextStyle),
                            },
                          });
                        }}
                        className="w-full rounded-xl border border-[color:var(--wsu-border)] bg-white px-3 py-1.5 text-xs font-medium focus:border-[color:var(--wsu-crimson)] focus:outline-none"
                      >
                        <option value="">Default (theme labels)</option>
                        {FIELD_TEXT_STYLE_VALUES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <p className="font-normal normal-case text-[color:var(--wsu-muted)]">Column header / field label style.</p>
                    </label>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-xs font-medium cursor-pointer text-[color:var(--wsu-muted)] hover:text-[color:var(--wsu-ink)]">
                      <input
                        type="radio"
                        name={`heading-${view.id}`}
                        checked={view.presentation?.headingFieldKey === field.key}
                        onChange={() => update("presentation", { ...view.presentation, headingFieldKey: field.key })}
                        className="text-[color:var(--wsu-crimson)] focus:ring-[color:var(--wsu-crimson)] h-3 w-3"
                      />
                      <span>Heading</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium cursor-pointer text-[color:var(--wsu-muted)] hover:text-[color:var(--wsu-ink)]">
                      <input
                        type="radio"
                        name={`summary-${view.id}`}
                        checked={view.presentation?.summaryFieldKey === field.key}
                        onChange={() => update("presentation", { ...view.presentation, summaryFieldKey: field.key })}
                        className="text-[color:var(--wsu-crimson)] focus:ring-[color:var(--wsu-crimson)] h-3 w-3"
                      />
                      <span>Summary</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium cursor-pointer text-[color:var(--wsu-muted)] hover:text-[color:var(--wsu-ink)]">
                      <input
                        type="checkbox"
                        checked={field.hideLabel ?? false}
                        onChange={(e) => updateField(index, { ...field, hideLabel: e.target.checked })}
                        className="rounded border-[color:var(--wsu-border)] text-[color:var(--wsu-crimson)] focus:ring-[color:var(--wsu-crimson)] h-3 w-3"
                      />
                      <span>Hide label</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium cursor-pointer text-[color:var(--wsu-muted)] hover:text-[color:var(--wsu-ink)]">
                      <input
                        type="checkbox"
                        checked={(field.emptyBehavior ?? "show") === "hide"}
                        onChange={(e) => updateField(index, { ...field, emptyBehavior: e.target.checked ? "hide" : "show" })}
                        className="rounded border-[color:var(--wsu-border)] text-[color:var(--wsu-crimson)] focus:ring-[color:var(--wsu-crimson)] h-3 w-3"
                      />
                      <span>Hide when empty</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium cursor-pointer text-[color:var(--wsu-muted)] hover:text-[color:var(--wsu-ink)]" title="Field used for A-Z index and search">
                      <input
                        type="checkbox"
                        checked={view.presentation?.indexFieldKey === field.key}
                        onChange={(e) => update("presentation", { ...view.presentation, indexFieldKey: e.target.checked ? field.key : undefined })}
                        className="rounded border-[color:var(--wsu-border)] text-[color:var(--wsu-crimson)] focus:ring-[color:var(--wsu-crimson)] h-3 w-3"
                      />
                      <span>A-Z index</span>
                    </label>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => moveField(index, "up")}
                    disabled={index === 0}
                    className="rounded-full border border-[color:var(--wsu-border)] px-3 py-1.5 text-sm disabled:opacity-40"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveField(index, "down")}
                    disabled={index === view.fields.length - 1}
                    className="rounded-full border border-[color:var(--wsu-border)] px-3 py-1.5 text-sm disabled:opacity-40"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => update("fields", view.fields.filter((_, i) => i !== index))}
                    className="rounded-full border border-rose-200 px-3 py-2 text-sm text-rose-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
              })
          )}
              {activeSource?.roleGroups && activeSource.roleGroups.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--wsu-muted)]">Add grouped role field</p>
                  <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">
                    Appends one <strong className="font-medium text-[color:var(--wsu-ink)]">People / grouped role</strong> field backed by a role group on this view&apos;s
                    source (admin → Sources → Role groups). On the source, <strong className="font-medium text-[color:var(--wsu-ink)]">fetch schema first</strong>, then add
                    or map groups. Works with <strong className="font-medium text-[color:var(--wsu-ink)]">one slot</strong> (single contact, e.g. assessment) or many; use{" "}
                    <strong className="font-medium text-[color:var(--wsu-ink)]">Add custom role group</strong> when columns are not named like “Coordinator 1” / “Coordinator 1 Email”.
                    <strong className="font-medium text-[color:var(--wsu-ink)]"> Remove group</strong> on the source card drops a group even when it only has one slot.
                  </p>
                  <div className="mt-2">
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v) {
                          addRoleGroupFieldToView(v);
                        }
                        e.target.value = "";
                      }}
                      className="w-full max-w-md rounded-xl border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Choose a role group to add…</option>
                      {activeSource.roleGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.label} ({g.id})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}
              </div>
            </div>

            {(livePreview || livePreviewLoading) && view.sourceId && view.fields.length > 0 && (
              <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-4">
                <ViewBuilderLivePreview
                  subtitle="Updates as you map columns and reorder (1s delay)"
                  view={view}
                  sourceMap={sourceMap}
                  livePreview={livePreview}
                  livePreviewLoading={livePreviewLoading}
                  livePreviewError={livePreviewError}
                  showEmptyAndErrorStates={false}
                />
              </div>
            )}
    </div>
  );
}
