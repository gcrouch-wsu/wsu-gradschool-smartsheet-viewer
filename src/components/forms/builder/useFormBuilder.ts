"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormFieldDefinition, FormFieldKindHint } from "@/lib/forms/form-field-config";
import type { ConditionalRule, SmartsheetColumn } from "@/lib/forms/types";
import { deriveFormFieldConfig, fieldMetaFromConfig } from "@/lib/forms/form-field-meta";
import type { FormSchema } from "@/lib/forms/form-ui";

export type BuilderFieldType = "text" | "textarea" | "email" | "dropdown" | "checkbox" | "date";

export interface BuilderState {
  sheetId: string;
  sheetName: string;
  columns: SmartsheetColumn[];
  fields: FormFieldDefinition[];
  conditionalLogic: ConditionalRule[];
  lockedTitles: string[];
  allowedDomains: string[];
  demo: boolean;
  attachmentsEnabled: boolean;
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
          : type === "dropdown"
            ? "Dropdown"
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
    case "checkbox":
      return { title, type: "CHECKBOX" };
    case "date":
      return { title, type: "DATE" };
    case "email":
      return { title, type: "TEXT_NUMBER" };
    case "textarea":
    case "text":
    default:
      return { title, type: "TEXT_NUMBER" };
  }
}

export function kindHintForType(type: BuilderFieldType): FormFieldKindHint | undefined {
  if (type === "textarea") return "textarea";
  if (type === "email") return "email";
  if (type === "text") return "text";
  return undefined;
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
        columns: (d.columns as SmartsheetColumn[]) ?? [],
        fields: (d.fields as FormFieldDefinition[]) ?? [],
        conditionalLogic: (d.conditionalLogic as ConditionalRule[]) ?? [],
        lockedTitles: Array.isArray(d.lockedTitles) ? (d.lockedTitles as string[]) : [],
        allowedDomains: Array.isArray(d.allowedDomains) ? (d.allowedDomains as string[]) : [],
        demo: Boolean(d.demo),
        attachmentsEnabled: d.attachmentsEnabled !== false,
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

  async function save() {
    if (!state) return;
    setSaving(true);
    setMessage(null);
    try {
      const r = await fetch("/api/forms/builder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: state.fields, conditionalLogic: state.conditionalLogic }),
      });
      const d = await parseJson(r);
      if (!r.ok) throw new Error((typeof d.error === "string" && d.error) || (typeof d.message === "string" && d.message) || "Save failed.");
      setDirty(false);
      setMessage({ ok: true, text: "Form layout saved." });
      await load();
    } catch (e: unknown) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Save failed." });
    } finally {
      setSaving(false);
    }
  }

  async function addField(type: BuilderFieldType) {
    if (!state) return;
    setMessage(null);
    const title = defaultTitleForType(
      type,
      state.fields.map((f) => f.columnTitle),
    );
    const payload = columnPayloadForType(type, title);
    try {
      const r = await fetch(`/api/forms/platform/sheets/${state.sheetId}/columns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns: [payload] }),
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
          hiddenOnForm: false,
          kindHint: hint,
          required: type !== "checkbox",
        },
      ];
      setState({ ...state, columns, fields: nextFields });
      setSelectedTitle(created.title);
      setDirty(true);

      await fetch("/api/forms/builder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: nextFields, conditionalLogic: state.conditionalLogic }),
      });
      setDirty(false);
      setMessage({ ok: true, text: `Added “${created.title}”.` });
      await load();
    } catch (e: unknown) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Could not add field." });
    }
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

  async function updatePicklistOptions(columnId: number, options: string[]) {
    if (!state) return;
    const r = await fetch(`/api/forms/platform/sheets/${state.sheetId}/columns/${columnId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "PICKLIST", options }),
    });
    const d = await parseJson(r);
    if (!r.ok) throw new Error((typeof d.error === "string" && d.error) || "Could not update options.");
  }

  async function deleteField(columnTitle: string) {
    if (!state) return;
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
      await fetch("/api/forms/builder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: nextFields, conditionalLogic: nextLogic }),
      });
      setDirty(false);
      setMessage({ ok: true, text: `Deleted “${columnTitle}”.` });
      await load();
    } catch (e: unknown) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Delete failed." });
    }
  }

  function setConditionalLogic(rules: ConditionalRule[]) {
    setState((prev) => (prev ? { ...prev, conditionalLogic: rules } : prev));
    setDirty(true);
    setMessage(null);
  }

  const previewSchema: FormSchema | null = useMemo(() => {
    if (!state) return null;
    const config = deriveFormFieldConfig(state.fields);
    const byTitle = new Map(state.columns.map((c) => [c.title.toLowerCase(), c]));
    const columns = config.columns.map((t) => byTitle.get(t.toLowerCase())).filter((c): c is SmartsheetColumn => Boolean(c));
    return {
      sheetName: state.sheetName,
      columns,
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
    updateField,
    updateFields,
    renameColumn,
    updatePicklistOptions,
    deleteField,
    setConditionalLogic,
    previewSchema,
  };
}
