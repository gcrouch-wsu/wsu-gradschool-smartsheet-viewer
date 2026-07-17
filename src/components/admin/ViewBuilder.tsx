"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { getEligibleEditableFieldDefinitions, getFieldsForMultiPersonGroup } from "@/lib/contributor-utils";
import { applyViewTemplate } from "@/lib/config/templates";
import { validateViewConfig } from "@/lib/config/validation";
import { parseViewConfigFromBackupJson } from "@/lib/view-backup-json";
import { effectiveViewDisplayTimeZone } from "@/lib/display-datetime";
import { effectiveValueLinkFlags } from "@/lib/transforms";
import { isRoleGroupFieldSource } from "@/lib/role-groups";
import { slugify } from "@/lib/utils";
import type {
  SourceConfig,
  SmartsheetColumn,
  ViewConfig,
  ViewEditingConfig,
  ViewFieldConfig,
  ViewFieldSource,
  ViewFilterConfig,
  ViewSortConfig,
} from "@/lib/config/types";
import type { ResolvedView } from "@/lib/config/types";
import type { SmartsheetSchemaSummary } from "@/lib/smartsheet";
import {
  ViewBuilderEditingTab,
  ViewBuilderFieldsTab,
  ViewBuilderFiltersTab,
  ViewBuilderPreviewTab,
  ViewBuilderSetupTab,
  type ExistingViewMeta,
  type RoleGroupOverlapWarning,
  type ViewBuilderTab,
  FETCH_CREDENTIALS,
  buildInitialView,
  columnToField,
  normalizedCompareKey,
  rawFieldOverlapsRoleGroup,
} from "./view-builder";


export function ViewBuilder({
  initialView,
  sources,
  existingViews,
  isNew,
}: {
  initialView: ViewConfig | null;
  sources: SourceConfig[];
  existingViews: ExistingViewMeta[];
  isNew: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [view, setView] = useState<ViewConfig>(() => buildInitialView(initialView, sources));
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string>("");
  const [schema, setSchema] = useState<SmartsheetSchemaSummary | null>(null);
  const [schemaError, setSchemaError] = useState<string>("");
  const [schemaLoading, setSchemaLoading] = useState(false);
  const sourceMap = useMemo(() => new Map(sources.map((source) => [source.id, source.label])), [sources]);
  const activeSource = useMemo(() => sources.find((s) => s.id === view.sourceId), [sources, view.sourceId]);
  const comparisonViewId = initialView?.id ?? null;
  const comparisonViews = useMemo(
    () => existingViews.filter((candidate) => candidate.id !== comparisonViewId),
    [comparisonViewId, existingViews],
  );
  const duplicateIdView = useMemo(() => {
    const targetId = normalizedCompareKey(view.id);
    if (!targetId) {
      return null;
    }
    return comparisonViews.find((candidate) => normalizedCompareKey(candidate.id) === targetId) ?? null;
  }, [comparisonViews, view.id]);
  const duplicateLabelViews = useMemo(() => {
    const targetLabel = normalizedCompareKey(view.label);
    if (!targetLabel) {
      return [];
    }
    return comparisonViews.filter((candidate) => normalizedCompareKey(candidate.label) === targetLabel);
  }, [comparisonViews, view.label]);
  const sharedSlugViews = useMemo(() => {
    const targetSlug = normalizedCompareKey(view.slug);
    if (!targetSlug) {
      return [];
    }
    return comparisonViews.filter((candidate) => normalizedCompareKey(candidate.slug) === targetSlug);
  }, [comparisonViews, view.slug]);
  /** One published view on this slug → canonical URL is /view/{slug} without ?view=. */
  const singlePublishedOnSlug = useMemo(() => {
    if (!view.public) {
      return false;
    }
    const n = existingViews.filter(
      (v) => v.public && normalizedCompareKey(v.slug) === normalizedCompareKey(view.slug),
    ).length;
    return n === 1;
  }, [existingViews, view.public, view.slug]);
  const hasBlockingIdConflict = Boolean(isNew && duplicateIdView);
  const contactColumns = useMemo(
    () => schema?.columns.filter((column) => column.type === "CONTACT_LIST" || column.type === "MULTI_CONTACT_LIST") ?? [],
    [schema],
  );
  const eligibleEditableFields = useMemo(
    () => (schema ? getEligibleEditableFieldDefinitions(view, schema.columns) : []),
    [schema, view],
  );
  const fieldsForMultiPersonGroup = useMemo(
    () => (schema ? getFieldsForMultiPersonGroup(view, schema.columns) : []),
    [schema, view],
  );
  const invalidEditableColumnIds = useMemo(() => {
    if (!schema || !view.editing?.enabled) {
      return [];
    }
    const eligibleIds = new Set(eligibleEditableFields.map((field) => field.columnId));
    return view.editing.editableColumnIds.filter((columnId) => !eligibleIds.has(columnId));
  }, [eligibleEditableFields, schema, view.editing]);
  const invalidContactColumnIds = useMemo(() => {
    if (!schema || !view.editing?.enabled) {
      return [];
    }
    const contactIds = new Set(contactColumns.map((column) => column.id));
    return view.editing.contactColumnIds.filter((columnId) => !contactIds.has(columnId));
  }, [contactColumns, schema, view.editing]);
  const roleGroupOverlapWarnings = useMemo<RoleGroupOverlapWarning[]>(() => {
    if (!activeSource?.roleGroups?.length) {
      return [];
    }

    const roleGroupsById = new Map(activeSource.roleGroups.map((group) => [group.id, group]));
    const rawFields = view.fields.filter((field) => !isRoleGroupFieldSource(field.source)) as Array<
      ViewFieldConfig & { source: ViewFieldSource }
    >;

    return view.fields.flatMap((field) => {
      if (!isRoleGroupFieldSource(field.source)) {
        return [];
      }

      const roleGroup = roleGroupsById.get(field.source.roleGroupId);
      if (!roleGroup) {
        return [];
      }

      const overlappingFields = rawFields
        .filter((rawField) => rawFieldOverlapsRoleGroup(rawField, roleGroup))
        .map((rawField) => ({
          key: rawField.key,
          label: rawField.label || rawField.key,
          sourceLabel: rawField.source.columnTitle || String(rawField.source.columnId ?? rawField.key),
        }));

      if (overlappingFields.length === 0) {
        return [];
      }

      return [
        {
          roleFieldKey: field.key,
          roleFieldLabel: field.label || roleGroup.defaultDisplayLabel || roleGroup.label || field.key,
          roleGroupId: roleGroup.id,
          overlappingFields,
        },
      ];
    });
  }, [activeSource?.roleGroups, view.fields]);
  const roleGroupOverlapByFieldKey = useMemo(
    () => new Map(roleGroupOverlapWarnings.map((warning) => [warning.roleFieldKey, warning])),
    [roleGroupOverlapWarnings],
  );

  function update<K extends keyof ViewConfig>(key: K, value: ViewConfig[K]) {
    setView((current) => ({ ...current, [key]: value }));
  }

  function updateEditing(nextEditing: ViewEditingConfig | undefined) {
    update("editing", nextEditing);
  }

  function updateField(index: number, nextField: ViewFieldConfig) {
    setView((current) => ({
      ...current,
      fields: current.fields.map((field, fieldIndex) => (fieldIndex === index ? nextField : field)),
    }));
  }

  function moveField(fromIndex: number, direction: "up" | "down") {
    const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= view.fields.length) return;
    setView((current) => {
      const next = [...current.fields];
      [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
      return { ...current, fields: next };
    });
  }

  function updateFilter(index: number, nextFilter: ViewFilterConfig) {
    setView((current) => ({
      ...current,
      filters: (current.filters ?? []).map((filter, filterIndex) => (filterIndex === index ? nextFilter : filter)),
    }));
  }

  function updateSort(index: number, nextSort: ViewSortConfig) {
    setView((current) => ({
      ...current,
      defaultSort: (current.defaultSort ?? []).map((sort, sortIndex) => (sortIndex === index ? nextSort : sort)),
    }));
  }

  const fetchSchema = useCallback(async () => {
    if (!view.sourceId) {
      setSchemaError("Select a source first.");
      return;
    }
    setSchemaLoading(true);
    setSchemaError("");
    setSchema(null);
    try {
      const response = await fetch(`/api/admin/sources/${view.sourceId}/schema`, {
        method: "GET",
        credentials: FETCH_CREDENTIALS,
      });
      const payload = (await response.json()) as {
        schema?: SmartsheetSchemaSummary;
        error?: string;
        errors?: string[];
      };
      if (!response.ok || !payload.schema) {
        setSchemaError(payload.errors?.join(" ") || payload.error || "Unable to fetch schema.");
        return;
      }
      setSchema(payload.schema);
    } finally {
      setSchemaLoading(false);
    }
  }, [view.sourceId]);

  useEffect(() => {
    setSchema(null);
    setSchemaError("");
  }, [view.sourceId]);

  function toggleColumnIncluded(col: SmartsheetColumn) {
    const match = view.fields.find(
      (f) =>
        !isRoleGroupFieldSource(f.source) &&
        (f.source.columnTitle === col.title || f.source.columnId === col.id),
    );
    if (match) {
      setView((current) => ({
        ...current,
        fields: current.fields.filter(
          (f) =>
            isRoleGroupFieldSource(f.source) ||
            (f.source.columnTitle !== col.title && f.source.columnId !== col.id),
        ),
      }));
    } else {
      setView((current) => {
        const usedKeys = new Set(current.fields.map((f) => f.key));
        return {
          ...current,
          fields: [...current.fields, columnToField(col, col.title, usedKeys)],
        };
      });
    }
  }

  function isColumnIncluded(col: SmartsheetColumn): boolean {
    return view.fields.some(
      (f) =>
        !isRoleGroupFieldSource(f.source) &&
        (f.source.columnTitle === col.title || f.source.columnId === col.id),
    );
  }

  function getFieldForColumn(col: SmartsheetColumn): ViewFieldConfig | undefined {
    return view.fields.find(
      (f) =>
        !isRoleGroupFieldSource(f.source) &&
        (f.source.columnTitle === col.title || f.source.columnId === col.id),
    );
  }

  function addRoleGroupFieldToView(roleGroupId: string) {
    const src = sources.find((s) => s.id === view.sourceId);
    const rg = src?.roleGroups?.find((g) => g.id === roleGroupId);
    if (!rg) {
      return;
    }
    let key = slugify(rg.label);
    let n = 0;
    while (view.fields.some((f) => f.key === key)) {
      n += 1;
      key = `${slugify(rg.label)}_${n}`;
    }
    setView((v) => ({
      ...v,
      fields: [
        ...v.fields,
        {
          key,
          label: rg.defaultDisplayLabel ?? rg.label,
          source: { kind: "role_group", roleGroupId },
          transforms: [],
          render: { type: "people_group", listDisplay: "inline", peopleStyle: "plain" },
        },
      ],
    }));
  }

  async function saveView() {
    if (hasBlockingIdConflict && duplicateIdView) {
      const msg = `View ID "${view.id}" already belongs to "${duplicateIdView.label || duplicateIdView.id}". Choose a different View ID before saving a new view.`;
      setErrors([msg]);
      setNotice("");
      toast.addToast(msg, "error");
      return;
    }

    setErrors([]);
    setNotice("");
    setIsSaving(true);

    try {
      const endpoint = isNew ? "/api/admin/views" : `/api/admin/views/${initialView?.id ?? view.id}`;
      const method = isNew ? "POST" : "PUT";
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        credentials: FETCH_CREDENTIALS,
        body: JSON.stringify(view),
      });
      const payload = (await response.json()) as { errors?: string[]; error?: string; warnings?: string[]; view?: ViewConfig };

      if (!response.ok) {
        const errs = payload.errors ?? payload.warnings ?? [payload.error ?? "Unable to save view."];
        setErrors(errs);
        toast.addToast(errs[0] ?? "Unable to save view.", "error");
        return;
      }

      const saved = payload.view ?? view;
      setView(saved);
      setNotice("View saved.");
      toast.addToast("View saved.", "success");
      router.replace(`/admin/views/${saved.id}`);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed.";
      setErrors([msg]);
      toast.addToast(msg, "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function onRestoreJsonFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) {
      return;
    }

    setErrors([]);
    setNotice("");
    setIsImporting(true);

    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(await file.text()) as unknown;
      } catch {
        toast.addToast("Invalid JSON file.", "error");
        return;
      }

      const parsedConfig = parseViewConfigFromBackupJson(parsed);
      if (!parsedConfig.ok) {
        setErrors([parsedConfig.error]);
        toast.addToast(parsedConfig.error, "error");
        return;
      }

      const validated = validateViewConfig(parsedConfig.config, {
        knownSourceIds: sources.map((s) => s.id),
        sources,
      });
      if (!validated.success || !validated.data) {
        const msg = validated.errors[0] ?? "Imported JSON failed validation.";
        setErrors(validated.errors);
        toast.addToast(msg, "error");
        return;
      }

      const editorViewId = initialView?.id ?? view.id;
      if (!isNew && editorViewId && validated.data.id !== editorViewId) {
        const msg = `This backup is for view "${validated.data.id}". Open that view in the editor, or use a backup for "${editorViewId}".`;
        setErrors([msg]);
        toast.addToast(msg, "error");
        return;
      }

      let config = validated.data;
      if (!isNew && editorViewId) {
        config = { ...config, id: editorViewId, slug: view.slug, public: view.public };
      }

      const saveNow = window.confirm(
        "Save this backup to the server now?\n\nOK = restore and save (replaces the saved view).\nCancel = load into the editor only — review the tabs, then click Save yourself.",
      );

      if (saveNow) {
        const endpoint = isNew ? "/api/admin/views" : `/api/admin/views/${editorViewId}`;
        const method = isNew ? "POST" : "PUT";
        const response = await fetch(endpoint, {
          method,
          headers: { "Content-Type": "application/json" },
          credentials: FETCH_CREDENTIALS,
          body: JSON.stringify(config),
        });
        const payload = (await response.json()) as {
          errors?: string[];
          error?: string;
          warnings?: string[];
          view?: ViewConfig;
        };

        if (!response.ok) {
          const errs = payload.errors ?? payload.warnings ?? [payload.error ?? "Unable to save imported view."];
          setErrors(errs);
          toast.addToast(errs[0] ?? "Restore failed.", "error");
          return;
        }

        const saved = payload.view ?? config;
        setView(saved);
        setNotice("View restored from JSON and saved.");
        toast.addToast("View restored from backup.", "success");
        router.replace(`/admin/views/${saved.id}`);
        router.refresh();
        return;
      }

      setView(config);
      setNotice("Backup loaded into the editor. Click Save when you are ready.");
      toast.addToast("Backup loaded — review the form, then Save.", "info");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed.";
      setErrors([msg]);
      toast.addToast(msg, "error");
    } finally {
      setIsImporting(false);
    }
  }

  async function deleteView() {
    const viewId = initialView?.id ?? view.id;
    if (!viewId) {
      return;
    }

    if (!window.confirm(`Delete view \"${viewId}\"? This cannot be undone.`)) {
      return;
    }

    setErrors([]);
    setNotice("");
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/admin/views/${viewId}`, {
        method: "DELETE",
        credentials: FETCH_CREDENTIALS,
      });
      const text = await response.text();
      let payload: { error?: string; errors?: string[] } = {};
      try {
        payload = (text ? JSON.parse(text) : {}) as { error?: string; errors?: string[] };
      } catch {
        payload = { error: "Delete failed. Server returned invalid response." };
      }

      if (!response.ok) {
        const errs = payload.errors ?? [payload.error ?? "Unable to delete view."];
        setErrors(Array.isArray(errs) ? errs : [errs]);
        toast.addToast(Array.isArray(errs) ? errs[0] : errs ?? "Unable to delete view.", "error");
        return;
      }

      toast.addToast("View deleted.", "success");
      router.push("/admin/views");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed.";
      setErrors([msg]);
      toast.addToast(msg, "error");
    } finally {
      setIsDeleting(false);
    }
  }

  async function togglePublish(nextPublic: boolean) {
    if (isNew) {
      setErrors(["Save the view before changing publication state."]);
      return;
    }

    setIsPublishing(true);

    try {
      const response = await fetch(`/api/admin/views/${initialView?.id ?? view.id}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: FETCH_CREDENTIALS,
        body: JSON.stringify({ public: nextPublic }),
      });
      const payload = (await response.json()) as { error?: string; errors?: string[]; warnings?: string[]; view?: ViewConfig };

      if (!response.ok || !payload.view) {
        const errs = payload.errors ?? payload.warnings ?? [payload.error ?? "Unable to update publication state."];
        setErrors(errs);
        toast.addToast(Array.isArray(errs) ? errs[0] : errs ?? "Unable to update publication state.", "error");
        return;
      }

      setView(payload.view);
      setNotice(nextPublic ? "View published." : "View unpublished.");
      toast.addToast(nextPublic ? "View published." : "View unpublished.", "success");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Publish failed.";
      setErrors([msg]);
      toast.addToast(msg, "error");
    } finally {
      setIsPublishing(false);
    }
  }

  function applyTemplate(templateId: string) {
    setView((current) => applyViewTemplate(current, templateId));
    setLastAppliedTemplateId(templateId);
    setErrors([]);
    setNotice("Layout applied. Open the Fields tab when you are ready to choose columns.");
    toast.addToast("Layout applied. Open Fields to add columns.", "info");
  }

  async function duplicateView() {
    const viewId = initialView?.id ?? view.id;
    if (!viewId) return;
    setErrors([]);
    try {
      const response = await fetch(`/api/admin/views/${viewId}/duplicate`, {
        method: "POST",
        credentials: FETCH_CREDENTIALS,
      });
      const payload = (await response.json()) as { view?: ViewConfig; error?: string };
      if (!response.ok || !payload.view) {
        setErrors([payload.error ?? "Unable to duplicate view."]);
        toast.addToast(payload.error ?? "Unable to duplicate view.", "error");
        return;
      }
      toast.addToast("View duplicated.", "success");
      router.push(`/admin/views/${payload.view.id}`);
      router.refresh();
    } catch {
      setErrors(["Failed to duplicate view."]);
      toast.addToast("Failed to duplicate view.", "error");
    }
  }

  const [activeTab, setActiveTab] = useState<ViewBuilderTab>("setup");
  const [lastAppliedTemplateId, setLastAppliedTemplateId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{
    resolvedView: ResolvedView;
    warnings: string[];
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string>("");
  const [previewViewport, setPreviewViewport] = useState<"full" | "768" | "375">("full");
  const [livePreview, setLivePreview] = useState<{ resolvedView: ResolvedView; warnings: string[] } | null>(null);
  const [livePreviewLoading, setLivePreviewLoading] = useState(false);
  const [livePreviewError, setLivePreviewError] = useState<string | null>(null);

  const fetchPreview = useCallback(async () => {
    setPreviewLoading(true);
    setPreviewError("");
    setPreviewData(null);
    try {
      const previewBody = {
        ...view,
        id: view.id || "preview",
        slug: view.slug || "preview",
        label: view.label || "Preview",
      };
      const response = await fetch("/api/admin/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: FETCH_CREDENTIALS,
        body: JSON.stringify(previewBody),
      });
      const payload = (await response.json()) as {
        rows?: ResolvedView["rows"];
        fields?: ResolvedView["fields"];
        warnings?: string[];
        rowCount?: number;
        error?: string;
        errors?: string[];
      };
      if (!response.ok || !payload.rows || !payload.fields) {
        const errMsg =
          Array.isArray(payload.errors) && payload.errors.length > 0
            ? payload.errors.join(" ")
            : payload.error ?? "Preview failed.";
        setPreviewError(errMsg);
        return;
      }
      const resolvedView: ResolvedView = {
        id: view.id,
        label: view.label,
        description: view.description,
        layout: view.layout,
        presentation: view.presentation,
        style: view.style,
        themePresetId: view.themePresetId,
        fixedLayout: view.fixedLayout,
        displayTimeZone: effectiveViewDisplayTimeZone(view),
        ...effectiveValueLinkFlags(view.presentation),
        rowCount: payload.rowCount ?? payload.rows.length,
        fields: payload.fields,
        rows: payload.rows,
      };
      setPreviewData({ resolvedView, warnings: payload.warnings ?? [] });
    } finally {
      setPreviewLoading(false);
    }
  }, [view]);

  useEffect(() => {
    if (activeTab === "preview") {
      void fetchPreview();
    }
  }, [activeTab, fetchPreview]);

  useEffect(() => {
    if (activeTab !== "setup" && activeTab !== "fields") return;
    if (!view.sourceId || view.fields.length === 0) {
      setLivePreview(null);
      setLivePreviewError(null);
      return;
    }
    const timer = setTimeout(() => {
      setLivePreviewLoading(true);
      const previewBody = {
        ...view,
        id: view.id || "preview",
        slug: view.slug || "preview",
        label: view.label || "Preview",
      };
      fetch("/api/admin/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: FETCH_CREDENTIALS,
        body: JSON.stringify(previewBody),
      })
        .then((r) => r.json())
        .then((payload: { rows?: ResolvedView["rows"]; fields?: ResolvedView["fields"]; warnings?: string[]; rowCount?: number; error?: string }) => {
          if (payload.rows && payload.fields) {
            setLivePreviewError(null);
            setLivePreview({
              resolvedView: {
                id: view.id,
                label: view.label,
                description: view.description,
                layout: view.layout,
                presentation: view.presentation,
                style: view.style,
                themePresetId: view.themePresetId,
                fixedLayout: view.fixedLayout,
                displayTimeZone: effectiveViewDisplayTimeZone(view),
                ...effectiveValueLinkFlags(view.presentation),
                rowCount: payload.rowCount ?? payload.rows.length,
                fields: payload.fields,
                rows: payload.rows,
              },
              warnings: payload.warnings ?? [],
            });
          } else {
            setLivePreview(null);
            setLivePreviewError(payload.error ?? "No preview data");
          }
        })
        .catch(() => {
          setLivePreview(null);
          setLivePreviewError("Failed to load preview");
        })
        .finally(() => setLivePreviewLoading(false));
    }, 1000);
    return () => clearTimeout(timer);
  }, [activeTab, view]);

  const previewHref = !isNew && view.id ? `/admin/views/${view.id}/preview` : null;

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] p-6 shadow-[0_16px_40px_rgba(35,31,32,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--wsu-crimson)]">View Builder</p>
            <h1 className="mt-2 text-3xl font-semibold text-[color:var(--wsu-ink)]">
              {isNew ? "Create view" : `Edit view: ${initialView?.label ?? view.label}`}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-[color:var(--wsu-muted)]">
              Build the public view config through the UI, then preview and publish it.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isNew && (
              <button
                type="button"
                onClick={() => void deleteView()}
                disabled={isDeleting}
                className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 hover:border-rose-400 hover:text-rose-800 disabled:opacity-50"
              >
                {isDeleting ? "Working..." : "Delete View"}
              </button>
            )}
            {previewHref && (
              <Link href={previewHref} className="rounded-full border border-[color:var(--wsu-border)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--wsu-muted)] hover:border-[color:var(--wsu-crimson)] hover:text-[color:var(--wsu-crimson)]">
                Preview
              </Link>
            )}
            {(!isNew && view.id) || isNew ? (
              <span className="flex flex-wrap items-center gap-2">
                <input
                  ref={importFileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  aria-label="Restore view from JSON backup file"
                  onChange={(e) => void onRestoreJsonFileSelected(e)}
                  disabled={isImporting || isSaving}
                />
                <button
                  type="button"
                  disabled={isImporting || isSaving}
                  title="Load a backup from Export JSON (viewConfig), a page bundle with viewConfigs + defaultViewId, or GET /api/admin/views/{id}"
                  onClick={() => importFileInputRef.current?.click()}
                  className="rounded-full border border-[color:var(--wsu-border)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--wsu-muted)] hover:border-[color:var(--wsu-crimson)] hover:text-[color:var(--wsu-crimson)] disabled:opacity-50"
                >
                  {isImporting ? "Reading…" : "Restore from JSON…"}
                </button>
                {!isNew && view.id ? (
                  <>
                    <a
                      href={`/api/admin/views/${view.id}/export`}
                      className="rounded-full border border-[color:var(--wsu-border)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--wsu-muted)] hover:border-[color:var(--wsu-crimson)] hover:text-[color:var(--wsu-crimson)]"
                    >
                      Export JSON
                    </a>
                    <a
                      href={`/api/admin/views/${view.id}/export?format=slim`}
                      title="Rows and display values only — smaller than full config backup"
                      className="rounded-full border border-[color:var(--wsu-border)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--wsu-muted)] hover:border-[color:var(--wsu-crimson)] hover:text-[color:var(--wsu-crimson)]"
                    >
                      Slim export
                    </a>
                  </>
                ) : null}
              </span>
            ) : null}
            {!isNew && (
              <button
                type="button"
                onClick={() => void togglePublish(!view.public)}
                disabled={isPublishing}
                className="rounded-full border border-[color:var(--wsu-border)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--wsu-muted)] hover:border-[color:var(--wsu-crimson)] hover:text-[color:var(--wsu-crimson)] disabled:opacity-50"
              >
                {isPublishing ? "Working..." : view.public ? "Unpublish" : "Publish"}
              </button>
            )}
            <button
              type="button"
              onClick={() => void saveView()}
              disabled={isSaving}
              className="btn-crimson rounded-full bg-[color:var(--wsu-crimson)] px-4 py-2 text-sm font-medium hover:bg-[color:var(--wsu-crimson-dark)] disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save View"}
            </button>
          </div>
        </div>

        {notice && <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
        {errors.length > 0 && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <ul className="space-y-1">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <nav className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="View builder tabs">
          {(["setup", "fields", "filters", "editing", "preview"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`tabpanel-${tab}`}
              id={`tab-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={`min-h-[44px] rounded-full border px-4 py-2 text-sm font-medium transition ${
                activeTab === tab
                  ? "border-[color:var(--wsu-crimson)] bg-[color:var(--wsu-crimson)] text-white"
                  : "border-[color:var(--wsu-border)] bg-white text-[color:var(--wsu-muted)] hover:border-[color:var(--wsu-crimson)] hover:text-[color:var(--wsu-crimson)]"
              }`}
            >
              {tab === "setup" && "Setup"}
              {tab === "fields" && "Fields"}
              {tab === "filters" && "Filters & Sort"}
              {tab === "editing" && "Editing"}
              {tab === "preview" && "Preview"}
            </button>
          ))}
        </nav>

        {activeTab === "setup" && (
          <ViewBuilderSetupTab
            view={view}
            setView={setView}
            sources={sources}
            isNew={isNew}
            sourceMap={sourceMap}
            duplicateIdView={duplicateIdView}
            duplicateLabelViews={duplicateLabelViews}
            sharedSlugViews={sharedSlugViews}
            singlePublishedOnSlug={singlePublishedOnSlug}
            update={update}
            applyTemplate={applyTemplate}
            lastAppliedTemplateId={lastAppliedTemplateId}
            duplicateView={duplicateView}
            previewHref={previewHref}
            livePreview={livePreview}
            livePreviewLoading={livePreviewLoading}
            livePreviewError={livePreviewError}
          />
        )}

        {activeTab === "fields" && (
          <ViewBuilderFieldsTab
            view={view}
            update={update}
            updateField={updateField}
            moveField={moveField}
            activeSource={activeSource}
            schema={schema}
            schemaError={schemaError}
            schemaLoading={schemaLoading}
            fetchSchema={fetchSchema}
            toggleColumnIncluded={toggleColumnIncluded}
            isColumnIncluded={isColumnIncluded}
            getFieldForColumn={getFieldForColumn}
            addRoleGroupFieldToView={addRoleGroupFieldToView}
            roleGroupOverlapWarnings={roleGroupOverlapWarnings}
            roleGroupOverlapByFieldKey={roleGroupOverlapByFieldKey}
            sourceMap={sourceMap}
            livePreview={livePreview}
            livePreviewLoading={livePreviewLoading}
            livePreviewError={livePreviewError}
          />
        )}

        {activeTab === "filters" && (
          <ViewBuilderFiltersTab
            view={view}
            update={update}
            updateFilter={updateFilter}
            updateSort={updateSort}
            schema={schema}
          />
        )}

        {activeTab === "editing" && (
          <ViewBuilderEditingTab
            view={view}
            updateEditing={updateEditing}
            fetchSchema={fetchSchema}
            schema={schema}
            schemaError={schemaError}
            schemaLoading={schemaLoading}
            contactColumns={contactColumns}
            eligibleEditableFields={eligibleEditableFields}
            fieldsForMultiPersonGroup={fieldsForMultiPersonGroup}
            invalidContactColumnIds={invalidContactColumnIds}
            invalidEditableColumnIds={invalidEditableColumnIds}
          />
        )}

        {activeTab === "preview" && (
          <ViewBuilderPreviewTab
            view={view}
            sourceMap={sourceMap}
            previewViewport={previewViewport}
            setPreviewViewport={setPreviewViewport}
            previewLoading={previewLoading}
            previewError={previewError}
            previewData={previewData}
            fetchPreview={fetchPreview}
          />
        )}
      </section>
    </div>
  );
}

