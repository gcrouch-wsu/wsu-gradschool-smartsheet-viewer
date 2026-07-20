"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  FormFieldDefinition,
  FormFieldKindHint,
  FormLayoutElementType,
} from "@/lib/forms/form-field-config";
import {
  defaultTextForLayout,
  isFieldFormItem,
  isLayoutFormItem,
  newLayoutElementId,
} from "@/lib/forms/form-field-config";
import type { ConditionalRule, SmartsheetColumn } from "@/lib/forms/types";
import { deriveFormFieldConfig, expandColumnsWithCheckboxGroups, fieldMetaFromConfig } from "@/lib/forms/form-field-meta";
import type { FormSchema } from "@/lib/forms/form-ui";

export type BuilderFieldType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "number"
  | "dropdown"
  | "multiselect"
  | "contact"
  | "checkbox"
  | "date";

export type BuilderElementType = BuilderFieldType | FormLayoutElementType;

export interface BuilderState {
  sheetId: string;
  sheetName: string;
  formTitle: string;
  formDescription: string;
  columns: SmartsheetColumn[];
  fields: FormFieldDefinition[];
  conditionalLogic: ConditionalRule[];
  lockedTitles: string[];
  /** Domains currently shown/edited in Builder (resolved for display; save writes this list). */
  allowedDomains: string[];
  /** Env fallback domains (for helper text). */
  envAllowedDomains: string[];
  formSlug: string;
  formPublic: boolean;
  publicUrl: string | null;
  attachmentsEnabled: boolean;
  envAttachmentsEnabled: boolean;
  demo: boolean;
}

async function parseJson(r: Response): Promise<Record<string, unknown>> {
  const text = await r.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(r.ok ? "Invalid response." : text.slice(0, 160) || `Request failed (${r.status}).`);
  }
}

export function defaultTitleForType(type: BuilderFieldType, existing: string[]): string {
  const base =
    type === "text"
      ? "Short text"
      : type === "textarea"
        ? "Long text"
        : type === "email"
          ? "Email"
          : type === "phone"
            ? "Phone"
            : type === "number"
              ? "Number"
              : type === "dropdown"
                ? "Dropdown"
                : type === "multiselect"
                  ? "Multi-select"
                  : type === "contact"
                    ? "Contact"
                    : type === "checkbox"
                      ? "Checkbox"
                      : "Date";
  const titles = new Set(existing.map((t) => t.toLowerCase()));
  if (!titles.has(base.toLowerCase())) return base;
  let i = 2;
  while (titles.has(`${base} ${i}`.toLowerCase())) i++;
  return `${base} ${i}`;
}

export function columnPayloadForType(type: BuilderFieldType, title: string) {
  switch (type) {
    case "dropdown":
      return { title, type: "PICKLIST", options: ["Option 1", "Option 2", "Option 3"] };
    case "multiselect":
      return { title, type: "MULTI_PICKLIST", options: ["Option 1", "Option 2", "Option 3"] };
    case "contact":
      return { title, type: "CONTACT_LIST" };
    case "checkbox":
      return { title, type: "CHECKBOX" };
    case "date":
      return { title, type: "DATE" };
    case "phone":
      return { title, type: "PHONE" };
    case "email":
    case "number":
    case "textarea":
    case "text":
    default:
      return { title, type: "TEXT_NUMBER" };
  }
}

export function kindHintForType(type: BuilderFieldType): FormFieldKindHint | undefined {
  if (type === "textarea") return "textarea";
  if (type === "email") return "email";
  if (type === "phone") return "phone";
  if (type === "number") return "number";
  if (type === "text") return "text";
  return undefined;
}

function isLayoutPaletteType(type: BuilderElementType): type is FormLayoutElementType {
  return type === "heading" || type === "description" || type === "divider";
}

export function useFormBuilder() {
  const [state, setState] = useState<BuilderState | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/forms/builder");
      const d = await parseJson(r);
      if (!r.ok) {
        throw new Error(
          (typeof d.error === "string" && d.error) ||
            (typeof d.message === "string" && d.message) ||
            `Could not load builder (${r.status}).`,
        );
      }
      const next: BuilderState = {
        sheetId: String(d.sheetId ?? ""),
        sheetName: String(d.sheetName ?? "Form"),
        formTitle: typeof d.formTitle === "string" ? d.formTitle : "",
        formDescription: typeof d.formDescription === "string" ? d.formDescription : "",
        columns: (d.columns as SmartsheetColumn[]) ?? [],
        fields: (d.fields as FormFieldDefinition[]) ?? [],
        conditionalLogic: (d.conditionalLogic as ConditionalRule[]) ?? [],
        lockedTitles: Array.isArray(d.lockedTitles) ? (d.lockedTitles as string[]) : [],
        allowedDomains: Array.isArray(d.allowedDomains) ? (d.allowedDomains as string[]) : ["wsu.edu"],
        envAllowedDomains: Array.isArray(d.envAllowedDomains) ? (d.envAllowedDomains as string[]) : ["wsu.edu"],
        formSlug: typeof d.formSlug === "string" ? d.formSlug : "",
        formPublic: Boolean(d.formPublic),
        publicUrl: typeof d.publicUrl === "string" ? d.publicUrl : null,
        attachmentsEnabled: d.attachmentsEnabled !== false,
        envAttachmentsEnabled: d.envAttachmentsEnabled !== false,
        demo: Boolean(d.demo),
      };
      setState(next);
      setSelectedTitle((prev) => {
        if (prev && next.fields.some((f) => f.columnTitle === prev)) return prev;
        return next.fields.find((f) => !f.hiddenOnForm)?.columnTitle ?? next.fields[0]?.columnTitle ?? null;
      });
      setDirty(false);
    } catch (e: unknown) {
      setState(null);
      setError(e instanceof Error ? e.message : "Could not load builder.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const lockedSet = useMemo(() => new Set((state?.lockedTitles ?? []).map((t) => t.toLowerCase())), [state?.lockedTitles]);

  function updateFields(updater: (fields: FormFieldDefinition[]) => FormFieldDefinition[]) {
    setState((prev) => {
      if (!prev) return prev;
      const fields = updater(prev.fields).map((f, order) => ({ ...f, order }));
      return { ...prev, fields };
    });
    setDirty(true);
    setMessage(null);
  }

  function updateField(columnTitle: string, patch: Partial<FormFieldDefinition>) {
    updateFields((fields) =>
      fields.map((f) => (f.columnTitle === columnTitle ? { ...f, ...patch, columnTitle: patch.columnTitle ?? f.columnTitle } : f)),
    );
  }

  async function persist(
    fields: FormFieldDefinition[],
    conditionalLogic: ConditionalRule[],
    presentation?: {
      formTitle: string;
      formDescription: string;
      allowedDomains: string[];
      attachmentsEnabled: boolean;
    },
  ) {
    if (!state) return;
    const r = await fetch("/api/forms/builder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields,
        conditionalLogic,
        formTitle: presentation?.formTitle ?? state.formTitle,
        formDescription: presentation?.formDescription ?? state.formDescription,
        allowedDomains: presentation?.allowedDomains ?? state.allowedDomains,
        attachmentsEnabled: presentation?.attachmentsEnabled ?? state.attachmentsEnabled,
      }),
    });
    const d = await parseJson(r);
    if (!r.ok) throw new Error((typeof d.error === "string" && d.error) || (typeof d.message === "string" && d.message) || "Save failed.");
  }

  async function save() {
    if (!state) return;
    setSaving(true);
    setMessage(null);
    try {
      await persist(state.fields, state.conditionalLogic);
      setDirty(false);
      setMessage({ ok: true, text: "Form layout saved." });
      await load();
    } catch (e: unknown) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Save failed." });
    } finally {
      setSaving(false);
    }
  }

  async function addLayoutElement(type: FormLayoutElementType) {
    if (!state) return;
    const id = newLayoutElementId(type);
    const nextFields: FormFieldDefinition[] = [
      ...state.fields,
      {
        columnTitle: id,
        order: state.fields.length,
        itemKind: type,
        text: defaultTextForLayout(type),
        hiddenOnForm: false,
      },
    ];
    setState({ ...state, fields: nextFields });
    setSelectedTitle(id);
    setDirty(true);
    try {
      await persist(nextFields, state.conditionalLogic);
      setDirty(false);
      setMessage({
        ok: true,
        text: type === "divider" ? "Added divider." : `Added ${type}.`,
      });
      await load();
    } catch (e: unknown) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Could not add element." });
    }
  }

  async function addField(type: BuilderFieldType) {
    if (!state) return;
    setMessage(null);
    const title = defaultTitleForType(
      type,
      state.fields.filter(isFieldFormItem).map((f) => f.columnTitle),
    );
    const payload = columnPayloadForType(type, title);
    try {
      const r = await fetch(`/api/forms/platform/sheets/${state.sheetId}/columns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns: [payload], index: state.columns.length }),
      });
      const d = await parseJson(r);
      if (!r.ok) throw new Error((typeof d.error === "string" && d.error) || (typeof d.message === "string" && d.message) || "Could not add column.");

      const colR = await fetch(`/api/forms/platform/sheets/${state.sheetId}/columns`);
      const colD = await parseJson(colR);
      if (!colR.ok) throw new Error("Column created but refresh failed.");
      const columns = (colD.columns as SmartsheetColumn[]) ?? [];
      const created = columns.find((c) => c.title.toLowerCase() === title.toLowerCase()) ?? columns[columns.length - 1];
      if (!created) throw new Error("Could not resolve new column.");

      const hint = kindHintForType(type);
      const nextFields: FormFieldDefinition[] = [
        ...state.fields,
        {
          columnTitle: created.title,
          order: state.fields.length,
          itemKind: "field",
          hiddenOnForm: false,
          kindHint: hint,
          required: type !== "checkbox",
        },
      ];
      setState({ ...state, columns, fields: nextFields });
      setSelectedTitle(created.title);
      setDirty(true);

      await persist(nextFields, state.conditionalLogic);
      setDirty(false);
      setMessage({ ok: true, text: `Added “${created.title}”.` });
      await load();
    } catch (e: unknown) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Could not add field." });
    }
  }

  async function addElement(type: BuilderElementType) {
    if (isLayoutPaletteType(type)) return addLayoutElement(type);
    return addField(type);
  }

  async function renameColumn(columnId: number, title: string) {
    if (!state) return;
    const r = await fetch(`/api/forms/platform/sheets/${state.sheetId}/columns/${columnId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const d = await parseJson(r);
    if (!r.ok) throw new Error((typeof d.error === "string" && d.error) || "Rename failed.");
  }

  async function updatePicklistOptions(columnId: number, options: string[], columnType: "PICKLIST" | "MULTI_PICKLIST" = "PICKLIST") {
    if (!state) return;
    const r = await fetch(`/api/forms/platform/sheets/${state.sheetId}/columns/${columnId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: columnType, options }),
    });
    const d = await parseJson(r);
    if (!r.ok) throw new Error((typeof d.error === "string" && d.error) || "Could not update options.");
  }

  async function updateColumnType(
    columnId: number,
    type: string,
    options?: string[],
  ) {
    if (!state) return;
    const body: Record<string, unknown> = { type };
    if (options) body.options = options;
    const r = await fetch(`/api/forms/platform/sheets/${state.sheetId}/columns/${columnId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await parseJson(r);
    if (!r.ok) throw new Error((typeof d.error === "string" && d.error) || "Could not update column type.");
  }

  async function deleteField(columnTitle: string) {
    if (!state) return;
    const item = state.fields.find((f) => f.columnTitle === columnTitle);
    if (!item) return;

    if (isLayoutFormItem(item)) {
      const nextFields = state.fields.filter((f) => f.columnTitle !== columnTitle);
      setState({ ...state, fields: nextFields });
      setSelectedTitle(nextFields[0]?.columnTitle ?? null);
      try {
        await persist(nextFields, state.conditionalLogic);
        setDirty(false);
        setMessage({ ok: true, text: "Removed form element." });
        await load();
      } catch (e: unknown) {
        setMessage({ ok: false, text: e instanceof Error ? e.message : "Delete failed." });
      }
      return;
    }

    if (lockedSet.has(columnTitle.toLowerCase())) {
      setMessage({ ok: false, text: "This column is locked and cannot be deleted from the form builder." });
      return;
    }
    const col = state.columns.find((c) => c.title === columnTitle);
    if (!col) return;
    if (!window.confirm(`Delete column “${columnTitle}” from Smartsheet? This cannot be undone.`)) return;

    try {
      const r = await fetch(`/api/forms/platform/sheets/${state.sheetId}/columns/${col.id}`, { method: "DELETE" });
      const d = await parseJson(r);
      if (!r.ok) throw new Error((typeof d.error === "string" && d.error) || "Delete failed.");
      const nextFields = state.fields.filter((f) => f.columnTitle !== columnTitle);
      const nextLogic = state.conditionalLogic
        .map((rule) => ({
          ...rule,
          showColumns: rule.showColumns.filter((t) => t.toLowerCase() !== columnTitle.toLowerCase()),
          whenColumn: rule.whenColumn.toLowerCase() === columnTitle.toLowerCase() ? "" : rule.whenColumn,
        }))
        .filter((rule) => rule.whenColumn && rule.showColumns.length);
      setState({
        ...state,
        columns: state.columns.filter((c) => c.id !== col.id),
        fields: nextFields,
        conditionalLogic: nextLogic,
      });
      setSelectedTitle(nextFields[0]?.columnTitle ?? null);
      await persist(nextFields, nextLogic);
      setDirty(false);
      setMessage({ ok: true, text: `Deleted “${columnTitle}”.` });
      await load();
    } catch (e: unknown) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Delete failed." });
    }
  }

  function setFormPresentation(patch: {
    formTitle?: string;
    formDescription?: string;
    allowedDomains?: string[];
    attachmentsEnabled?: boolean;
  }) {
    setState((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
    setMessage(null);
  }

  function setConditionalLogic(rules: ConditionalRule[]) {
    setState((prev) => (prev ? { ...prev, conditionalLogic: rules } : prev));
    setDirty(true);
    setMessage(null);
  }

  const previewSchema: FormSchema | null = useMemo(() => {
    if (!state) return null;
    const config = deriveFormFieldConfig(state.fields, {
      formTitle: state.formTitle,
      formDescription: state.formDescription,
      allowedDomains: state.allowedDomains,
      attachmentsEnabled: state.attachmentsEnabled,
    });
    const byTitle = new Map(state.columns.map((c) => [c.title.toLowerCase(), c]));
    const baseColumns = config.columns
      .map((t) => byTitle.get(t.toLowerCase()))
      .filter((c): c is SmartsheetColumn => Boolean(c));
    const columns = expandColumnsWithCheckboxGroups(baseColumns, state.columns, config);
    return {
      sheetName: state.sheetName,
      formTitle: state.formTitle,
      formDescription: state.formDescription,
      columns,
      formItems: config.fields?.filter((f) => !f.hiddenOnForm) ?? [],
      formColumnSource: "smartsheet-config",
      fieldMeta: fieldMetaFromConfig(config),
      conditionalLogic: state.conditionalLogic,
      allowedDomains: state.allowedDomains,
      demo: state.demo,
      attachmentsEnabled: state.attachmentsEnabled,
    };
  }, [state]);

  return {
    state,
    selectedTitle,
    setSelectedTitle,
    loading,
    saving,
    error,
    message,
    dirty,
    lockedSet,
    load,
    save,
    addField,
    addElement,
    updateField,
    updateFields,
    renameColumn,
    updatePicklistOptions,
    updateColumnType,
    deleteField,
    setFormPresentation,
    setConditionalLogic,
    previewSchema,
  };
}
