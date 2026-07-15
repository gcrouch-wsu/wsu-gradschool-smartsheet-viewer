"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import {
  countDelimitedRoleAttributes,
  detectNumberedRoleGroupsFromColumns,
  mergeRoleGroupSuggestions,
  parseRoleGroupDelimiterInput,
  roleGroupDelimitersToInputString,
} from "@/lib/role-groups";
import type { SmartsheetSchemaSummary } from "@/lib/smartsheet";
import type { FieldSourceSelector, SmartsheetColumn, SourceConfig, SourceRoleGroupConfig } from "@/lib/config/types";
import { slugify } from "@/lib/utils";

type CatalogItem = { id: number; name: string };

function SmartsheetResourcePicker({
  sourceType,
  connectionKey,
  apiBaseUrl,
  smartsheetId,
  onSelect,
}: {
  sourceType: SourceConfig["sourceType"];
  connectionKey?: string;
  apiBaseUrl?: string;
  smartsheetId: number;
  onSelect: (item: CatalogItem) => void;
}) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualId, setManualId] = useState(smartsheetId > 0 ? String(smartsheetId) : "");
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => items.find((item) => item.id === smartsheetId) ?? null,
    [items, smartsheetId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) => item.name.toLowerCase().includes(q) || String(item.id).includes(q),
    );
  }, [items, query]);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ type: sourceType });
      if (connectionKey?.trim()) params.set("connectionKey", connectionKey.trim());
      if (apiBaseUrl?.trim()) params.set("apiBaseUrl", apiBaseUrl.trim());
      const response = await fetch(`/api/admin/smartsheet/catalog?${params}`, {
        credentials: "include",
      });
      const payload = (await response.json()) as { items?: CatalogItem[]; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || `Could not load ${sourceType}s (${response.status}).`);
      }
      setItems(Array.isArray(payload.items) ? payload.items : []);
    } catch (e: unknown) {
      setItems([]);
      setError(e instanceof Error ? e.message : `Could not load ${sourceType}s.`);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, connectionKey, sourceType]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCatalog();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [loadCatalog]);

  useEffect(() => {
    setQuery("");
    setOpen(false);
    setManualMode(false);
    setManualId(smartsheetId > 0 ? String(smartsheetId) : "");
  }, [sourceType]);

  useEffect(() => {
    setManualId(smartsheetId > 0 ? String(smartsheetId) : "");
  }, [smartsheetId]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const displayValue = open
    ? query
    : selected
      ? `${selected.name} (ID ${selected.id})`
      : smartsheetId > 0
        ? `ID ${smartsheetId}`
        : "";

  if (manualMode) {
    return (
      <div className="flex flex-col gap-2" ref={rootRef}>
        <div className="flex h-6 items-center justify-between gap-2">
          <span className="text-sm font-medium text-[color:var(--wsu-ink)]">Smartsheet ID</span>
          <button
            type="button"
            className="shrink-0 whitespace-nowrap text-xs font-medium text-wsu-crimson hover:underline"
            onClick={() => setManualMode(false)}
          >
            Use searchable list
          </button>
        </div>
        <input
          type="number"
          value={manualId}
          onChange={(event) => {
            const next = event.target.value;
            setManualId(next);
            const id = Number(next);
            if (Number.isFinite(id) && id > 0) {
              onSelect({ id, name: selected?.name ?? "" });
            }
          }}
          placeholder="From sheet/report URL"
          className="w-full rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-3 text-sm"
        />
        <p className="min-h-4 text-xs text-[color:var(--wsu-muted)]">
          Numeric ID from the Smartsheet URL when the resource isn&apos;t in the list.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" ref={rootRef}>
      <div className="flex h-6 items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-[color:var(--wsu-ink)]">
          {sourceType === "report" ? "Smartsheet report" : "Smartsheet sheet"}
        </span>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            className="whitespace-nowrap text-xs font-medium text-[color:var(--wsu-muted)] hover:text-wsu-crimson hover:underline disabled:opacity-50"
            onClick={() => void loadCatalog()}
            disabled={loading}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
          <button
            type="button"
            className="whitespace-nowrap text-xs font-medium text-wsu-crimson hover:underline"
            onClick={() => {
              setManualMode(true);
              setOpen(false);
            }}
          >
            Enter ID manually
          </button>
        </div>
      </div>

      <div className="relative">
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls="smartsheet-catalog-listbox"
          aria-autocomplete="list"
          value={displayValue}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            if (selected) setQuery("");
          }}
          placeholder={loading ? `Loading ${sourceType}s…` : `Search ${sourceType}s by name or ID…`}
          disabled={loading && items.length === 0}
          className="w-full rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-wsu-crimson"
        />

        {open ? (
          <ul
            id="smartsheet-catalog-listbox"
            role="listbox"
            className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-[color:var(--wsu-border)] bg-white py-1 shadow-lg"
          >
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-[color:var(--wsu-muted)]">
                {loading ? "Loading…" : error || `No matching ${sourceType}s.`}
              </li>
            ) : (
              filtered.slice(0, 100).map((item) => {
                const isActive = item.id === smartsheetId;
                return (
                  <li key={item.id} role="option" aria-selected={isActive}>
                    <button
                      type="button"
                      className={[
                        "flex w-full items-start gap-2 px-4 py-2.5 text-left text-sm hover:bg-[color:var(--wsu-stone)]",
                        isActive ? "bg-wsu-crimson/5 text-wsu-crimson" : "text-[color:var(--wsu-ink)]",
                      ].join(" ")}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        onSelect(item);
                        setQuery("");
                        setOpen(false);
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
                      <span className="shrink-0 text-xs text-[color:var(--wsu-muted)]">ID {item.id}</span>
                    </button>
                  </li>
                );
              })
            )}
            {filtered.length > 100 ? (
              <li className="border-t border-[color:var(--wsu-border)] px-4 py-2 text-xs text-[color:var(--wsu-muted)]">
                Showing first 100 matches — type to narrow the list.
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>

      {error && !loading ? (
        <p className="min-h-4 text-xs text-amber-800">{error}</p>
      ) : (
        <p className="min-h-4 text-xs text-[color:var(--wsu-muted)]">
          {items.length
            ? `${items.length} ${sourceType}${items.length === 1 ? "" : "s"} available for this connection.`
            : `Pick a ${sourceType} from your Smartsheet account, or enter the ID manually.`}
        </p>
      )}
    </div>
  );
}

function buildInitialState(source: SourceConfig | null, connectionKeys: string[]): SourceConfig {
  return (
    source ?? {
      id: "",
      label: "",
      sourceType: "sheet",
      smartsheetId: 0,
      connectionKey: connectionKeys[0] ?? "default",
      apiBaseUrl: "https://api.smartsheet.com/2.0",
      cacheTtlSeconds: 120,
      fetchOptions: {
        includeObjectValue: true,
        includeColumnOptions: true,
        level: 2,
      },
    }
  );
}

function getRoleGroupAttributeKeys(roleGroup: SourceRoleGroupConfig) {
  if (roleGroup.mode === "numbered_slots") {
    return (["name", "email", "phone", "campus"] as const).filter((attr) =>
      roleGroup.slots?.some((slot) => Boolean(slot[attr])),
    );
  }

  return ["name", "email", "phone"].filter((attr) => Boolean(roleGroup.delimited?.[attr as "name" | "email" | "phone"]?.source));
}

function numberedSlotsHaveDuplicateIds(slots: { slot: string }[] | undefined): boolean {
  const counts = new Map<string, number>();
  for (const s of slots ?? []) {
    const id = s.slot.trim();
    if (!id) {
      continue;
    }
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.values()].some((n) => n > 1);
}

function selectorLabel(selector: { columnTitle?: string; columnId?: number } | undefined) {
  if (!selector) {
    return "Unmapped";
  }
  if (selector.columnTitle?.trim()) {
    return selector.columnTitle.trim();
  }
  if (typeof selector.columnId === "number") {
    return `Column ${selector.columnId}`;
  }
  return "Unmapped";
}

function selectorToSelectValue(selector: FieldSourceSelector | undefined): string {
  if (selector && typeof selector.columnId === "number") {
    return String(selector.columnId);
  }
  return "";
}

function selectorFromColumnPick(
  columns: SmartsheetColumn[],
  columnIdStr: string,
  previous?: FieldSourceSelector | undefined,
): FieldSourceSelector | undefined {
  if (!columnIdStr) {
    return undefined;
  }
  const id = Number(columnIdStr);
  if (!Number.isFinite(id)) {
    return undefined;
  }
  const col = columns.find((c) => c.id === id);
  if (col) {
    return { columnId: col.id, columnTitle: col.title, columnType: col.type };
  }
  if (previous && previous.columnId === id) {
    return previous;
  }
  return { columnId: id, columnTitle: previous?.columnTitle, columnType: previous?.columnType };
}

function RoleGroupColumnSelect({
  htmlId,
  columns,
  value,
  onChange,
  schemaLoaded,
  accessibilityLabel,
}: {
  htmlId: string;
  columns: SmartsheetColumn[];
  value: FieldSourceSelector | undefined;
  onChange: (next: FieldSourceSelector | undefined) => void;
  schemaLoaded: boolean;
  accessibilityLabel: string;
}) {
  const sorted = useMemo(
    () =>
      [...columns].sort((a, b) =>
        (a.title ?? "").localeCompare(b.title ?? "", undefined, { sensitivity: "base" }),
      ),
    [columns],
  );
  const selectValue = selectorToSelectValue(value);
  const orphanSelected =
    Boolean(selectValue) && !sorted.some((c) => String(c.id) === selectValue);

  if (!schemaLoaded || sorted.length === 0) {
    return (
      <div className="space-y-0.5">
        <p className="break-words text-[color:var(--wsu-ink)]">{selectorLabel(value)}</p>
        <p className="text-[10px] text-[color:var(--wsu-muted)]">
          Use <strong className="font-medium text-[color:var(--wsu-ink)]">Test + Fetch Schema</strong> on this page. Then
          column <strong className="font-medium">dropdowns</strong> replace this note so you can map fields.
        </p>
      </div>
    );
  }

  return (
    <select
      id={htmlId}
      aria-label={accessibilityLabel}
      value={selectValue}
      onChange={(e) => onChange(selectorFromColumnPick(sorted, e.target.value, value))}
      className="w-full min-w-[10rem] max-w-[22rem] rounded-lg border border-[color:var(--wsu-border)] bg-white px-2 py-1.5 text-xs text-[color:var(--wsu-ink)]"
    >
      <option value="">— Unmapped —</option>
      {orphanSelected ? (
        <option value={selectValue}>{`${selectorLabel(value)} (not in loaded schema)`}</option>
      ) : null}
      {sorted.map((col) => (
        <option key={col.id} value={String(col.id)}>
          {col.title} · {col.type}
        </option>
      ))}
    </select>
  );
}

export function SourceForm({
  initialSource,
  connectionKeys,
  isNew,
}: {
  initialSource: SourceConfig | null;
  connectionKeys: string[];
  isNew: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<SourceConfig>(() => buildInitialState(initialSource, connectionKeys));
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string>("");
  const [schema, setSchema] = useState<SmartsheetSchemaSummary | null>(null);
  const [schemaError, setSchemaError] = useState<string>("");
  const [customRoleGroupLabel, setCustomRoleGroupLabel] = useState("");
  const connectionOptions = useMemo(() => Array.from(new Set(connectionKeys.filter(Boolean))), [connectionKeys]);

  function update<K extends keyof SourceConfig>(key: K, value: SourceConfig[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateFetchOption(key: keyof NonNullable<SourceConfig["fetchOptions"]>, value: boolean | number | undefined) {
    setForm((current) => ({
      ...current,
      fetchOptions: {
        includeObjectValue: current.fetchOptions?.includeObjectValue ?? true,
        includeColumnOptions: current.fetchOptions?.includeColumnOptions ?? true,
        level: current.fetchOptions?.level,
        [key]: value,
      },
    }));
  }

  function updateRoleGroup(roleGroupId: string, updater: (roleGroup: SourceRoleGroupConfig) => SourceRoleGroupConfig) {
    setForm((current) => ({
      ...current,
      roleGroups: (current.roleGroups ?? []).map((roleGroup) =>
        roleGroup.id === roleGroupId ? updater(roleGroup) : roleGroup,
      ),
    }));
  }

  function updateRoleGroupTrustPairing(roleGroupId: string, trustPairing: boolean) {
    updateRoleGroup(roleGroupId, (roleGroup) => {
      if (roleGroup.mode !== "delimited_parallel" || !roleGroup.delimited) {
        return roleGroup;
      }

      return {
        ...roleGroup,
        delimited: {
          ...roleGroup.delimited,
          trustPairing: trustPairing || undefined,
        },
      };
    });
  }

  async function saveSource() {
    setErrors([]);
    setNotice("");

    const endpoint = isNew ? "/api/admin/sources" : `/api/admin/sources/${initialSource?.id ?? form.id}`;
    const method = isNew ? "POST" : "PUT";
    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(form),
    });
    const payload = (await response.json()) as { errors?: string[]; source?: SourceConfig; error?: string };

    if (!response.ok) {
      const errs = payload.errors ?? [payload.error ?? "Unable to save source."];
      setErrors(Array.isArray(errs) ? errs : [errs]);
      toast.addToast(Array.isArray(errs) ? errs[0] : errs ?? "Unable to save source.", "error");
      return;
    }

    const saved = payload.source ?? form;
    setForm(saved);
    setNotice("Source saved.");
    toast.addToast("Source saved.", "success");
    router.replace(`/admin/sources/${saved.id}`);
    router.refresh();
  }

  async function deleteSource() {
    const sourceId = initialSource?.id ?? form.id;
    if (!sourceId) {
      return;
    }

    if (!window.confirm(`Delete source \"${sourceId}\"? This cannot be undone.`)) {
      return;
    }

    setErrors([]);
    setNotice("");
    const response = await fetch(`/api/admin/sources/${sourceId}`, {
      method: "DELETE",
      credentials: "include",
    });
    const payload = (await response.json()) as { error?: string; errors?: string[] };

    if (!response.ok) {
      const errs = payload.errors ?? [payload.error ?? "Unable to delete source."];
      setErrors(Array.isArray(errs) ? errs : [errs]);
      toast.addToast(Array.isArray(errs) ? errs[0] : errs ?? "Unable to delete source.", "error");
      return;
    }

    toast.addToast("Source deleted.", "success");
    router.push("/admin/sources");
    router.refresh();
  }

  async function fetchSchema() {
    setSchema(null);
    setSchemaError("");

    const response = await fetch(`/api/admin/sources/${form.id || "preview"}/schema`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(form),
    });
    const payload = (await response.json()) as {
      schema?: SmartsheetSchemaSummary;
      connection?: { ok: boolean; error?: string };
      error?: string;
      errors?: string[];
    };

    if (!response.ok || !payload.schema) {
      const err = payload.errors?.join(" ") || payload.error || payload.connection?.error || "Unable to fetch schema.";
      setSchemaError(err);
      toast.addToast(err, "error");
      return;
    }

    setSchema(payload.schema);
    const noticeMsg = payload.connection?.ok === false ? "Connection warning returned during schema fetch." : "Connection verified and schema loaded.";
    setNotice(noticeMsg);
    toast.addToast(payload.connection?.ok === false ? "Schema loaded with connection warning." : "Connection verified.", "success");
  }

  function mergeDetectedRoleGroupsFromSchema() {
    if (!schema) {
      return;
    }
    const detected = detectNumberedRoleGroupsFromColumns(schema.columns);
    if (detected.length === 0) {
      toast.addToast("No numbered role-column patterns detected in this schema.", "error");
      return;
    }
    setForm((f) => ({
      ...f,
      roleGroups: mergeRoleGroupSuggestions(f.roleGroups, detected),
    }));
    toast.addToast(`Merged ${detected.length} detected role group(s). Save the source to persist.`, "success");
  }

  function removeEntireRoleGroup(roleGroupId: string) {
    setForm((current) => ({
      ...current,
      roleGroups: (current.roleGroups ?? []).filter((g) => g.id !== roleGroupId),
    }));
    toast.addToast("Role group removed from this draft. Save source to persist.", "success");
  }

  function addCustomNumberedRoleGroup() {
    if (!schema?.columns?.length) {
      toast.addToast("Load the schema first (Schema preview → Fetch schema now or Test + Fetch Schema), then add a role group.", "error");
      return;
    }
    const label = customRoleGroupLabel.trim();
    if (!label) {
      toast.addToast("Enter a label for the new role group.", "error");
      return;
    }
    setForm((current) => {
      const existing = current.roleGroups ?? [];
      let id = slugify(label) || "role_group";
      let n = 0;
      while (existing.some((g) => g.id === id)) {
        n += 1;
        id = `${slugify(label) || "role_group"}_${n}`;
      }
      const added: SourceRoleGroupConfig = {
        id,
        label,
        defaultDisplayLabel: label,
        mode: "numbered_slots",
        slots: [{ slot: "1" }],
      };
      return { ...current, roleGroups: [...existing, added] };
    });
    setCustomRoleGroupLabel("");
    toast.addToast(
      `Added “${label}” with one slot. Map name/email columns in the table below, then save the source. Use + Add slot if this role has multiple people.`,
      "success",
    );
  }

  const schemaColumns = schema?.columns ?? [];
  const schemaLoaded = Boolean(schema && schema.columns.length > 0);

  function setNumberedSlotId(roleGroupId: string, slotIndex: number, raw: string) {
    updateRoleGroup(roleGroupId, (rg) => {
      if (rg.mode !== "numbered_slots") {
        return rg;
      }
      const slots = [...(rg.slots ?? [])];
      const cur = slots[slotIndex];
      if (!cur) {
        return rg;
      }
      slots[slotIndex] = { ...cur, slot: raw.trim() };
      return { ...rg, slots };
    });
  }

  function updateNumberedSlotAttr(
    roleGroupId: string,
    slotIndex: number,
    attr: "name" | "email" | "phone" | "campus",
    selector: FieldSourceSelector | undefined,
  ) {
    updateRoleGroup(roleGroupId, (rg) => {
      if (rg.mode !== "numbered_slots") {
        return rg;
      }
      const slots = [...(rg.slots ?? [])];
      const cur = slots[slotIndex];
      if (!cur) {
        return rg;
      }
      const next = { ...cur };
      if (selector) {
        next[attr] = selector;
      } else {
        delete next[attr];
      }
      slots[slotIndex] = next;
      return { ...rg, slots };
    });
  }

  function addNumberedSlot(roleGroupId: string) {
    updateRoleGroup(roleGroupId, (rg) => {
      if (rg.mode !== "numbered_slots") {
        return rg;
      }
      const slots = [...(rg.slots ?? [])];
      const used = new Set(slots.map((s) => s.slot));
      let n = slots.length + 1;
      let slotId = String(n);
      while (used.has(slotId)) {
        n += 1;
        slotId = String(n);
      }
      slots.push({ slot: slotId });
      return { ...rg, slots };
    });
  }

  function removeNumberedSlot(roleGroupId: string, slotIndex: number) {
    updateRoleGroup(roleGroupId, (rg) => {
      if (rg.mode !== "numbered_slots") {
        return rg;
      }
      const slots = (rg.slots ?? []).filter((_, i) => i !== slotIndex);
      return { ...rg, slots };
    });
  }

  function finalizeDelimited(
    base: NonNullable<SourceRoleGroupConfig["delimited"]>,
  ): NonNullable<SourceRoleGroupConfig["delimited"]> {
    const hasAttr = (["name", "email", "phone"] as const).some((k) => base[k]?.source);
    if (!hasAttr) {
      return { pairing: base.pairing ?? "by_position" };
    }
    return base;
  }

  function updateDelimitedAttrSelector(
    roleGroupId: string,
    attr: "name" | "email" | "phone",
    selector: FieldSourceSelector | undefined,
  ) {
    updateRoleGroup(roleGroupId, (rg) => {
      if (rg.mode !== "delimited_parallel") {
        return rg;
      }
      const prev = rg.delimited;
      const pairing = prev?.pairing ?? "by_position";
      const base: NonNullable<SourceRoleGroupConfig["delimited"]> = {
        pairing,
        ...(prev?.trustPairing ? { trustPairing: true as const } : {}),
      };
      for (const key of ["name", "email", "phone"] as const) {
        const oldEntry = prev?.[key];
        if (key === attr) {
          if (selector) {
            base[key] = {
              source: selector,
              ...(oldEntry?.delimiters?.length ? { delimiters: oldEntry.delimiters } : {}),
            };
          }
        } else if (oldEntry?.source) {
          base[key] = oldEntry;
        }
      }
      return { ...rg, delimited: finalizeDelimited(base) };
    });
  }

  function updateDelimitedAttrDelimiters(
    roleGroupId: string,
    attr: "name" | "email" | "phone",
    rawDelimiters: string,
  ) {
    updateRoleGroup(roleGroupId, (rg) => {
      if (rg.mode !== "delimited_parallel") {
        return rg;
      }
      const prev = rg.delimited;
      const entry = prev?.[attr];
      if (!entry?.source) {
        return rg;
      }
      const delimArr = parseRoleGroupDelimiterInput(rawDelimiters);
      const pairing = prev?.pairing ?? "by_position";
      const base: NonNullable<SourceRoleGroupConfig["delimited"]> = {
        pairing,
        ...(prev?.trustPairing ? { trustPairing: true as const } : {}),
      };
      for (const key of ["name", "email", "phone"] as const) {
        const old = prev?.[key];
        if (!old?.source) {
          continue;
        }
        if (key === attr) {
          base[key] = delimArr.length ? { source: entry.source, delimiters: delimArr } : { source: entry.source };
        } else {
          base[key] = old;
        }
      }
      return { ...rg, delimited: finalizeDelimited(base) };
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] p-6 shadow-[0_16px_40px_rgba(35,31,32,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--wsu-crimson)]">
              Source Registry
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[color:var(--wsu-ink)]">
              {isNew ? "Create source" : `Edit source: ${initialSource?.label ?? form.label}`}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-[color:var(--wsu-muted)]">
              Register the Smartsheet source once, then point one or more views at it.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isNew && (
              <button
                type="button"
                onClick={() => startTransition(() => {
                  void deleteSource();
                })}
                className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 hover:border-rose-400 hover:text-rose-800"
              >
                {isPending ? "Working..." : "Delete Source"}
              </button>
            )}
            <button
              type="button"
              onClick={() => startTransition(() => {
                void fetchSchema();
              })}
              className="rounded-full border border-[color:var(--wsu-border)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--wsu-muted)] hover:border-[color:var(--wsu-crimson)] hover:text-[color:var(--wsu-crimson)]"
            >
              {isPending ? "Working..." : "Test + Fetch Schema"}
            </button>
            <button
              type="button"
              onClick={() => startTransition(() => {
                void saveSource();
              })}
              className="rounded-full bg-[color:var(--wsu-crimson)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--wsu-crimson-dark)]"
            >
              {isPending ? "Saving..." : "Save Source"}
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

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[color:var(--wsu-ink)]">Source ID</span>
            <input
              value={form.id}
              disabled={!isNew}
              onChange={(event) => update("id", event.target.value)}
              placeholder="e.g. grad-programs"
              className="w-full rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-3 disabled:bg-[color:var(--wsu-stone)]"
            />
            <p className="text-xs text-[color:var(--wsu-muted)]">Unique, URL-safe identifier. Set once at creation; cannot be changed.</p>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[color:var(--wsu-ink)]">Label</span>
            <input
              value={form.label}
              onChange={(event) => update("label", event.target.value)}
              placeholder="e.g. Graduate Programs"
              className="w-full rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-3"
            />
            <p className="text-xs text-[color:var(--wsu-muted)]">Display name shown in the admin UI. Editable anytime.</p>
          </label>
          <div className="contents">
            <div className="flex flex-col gap-2">
              <div className="flex h-6 items-center">
                <span className="text-sm font-medium text-[color:var(--wsu-ink)]">Source type</span>
              </div>
              <select
                value={form.sourceType}
                onChange={(event) => {
                  const sourceType = event.target.value as SourceConfig["sourceType"];
                  setForm((current) => ({
                    ...current,
                    sourceType,
                    // Clear selection when switching sheet ↔ report to avoid mismatched IDs.
                    smartsheetId: 0,
                  }));
                  setSchema(null);
                  setSchemaError("");
                }}
                className="w-full rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-3 text-sm"
              >
                <option value="sheet">Sheet</option>
                <option value="report">Report</option>
              </select>
            </div>
            <SmartsheetResourcePicker
              sourceType={form.sourceType}
              connectionKey={form.connectionKey}
              apiBaseUrl={form.apiBaseUrl}
              smartsheetId={form.smartsheetId}
              onSelect={(item) => {
                setForm((current) => {
                  const canAutofillName = Boolean(item.name?.trim()) && !/^Smartsheet \d+$/i.test(item.name.trim());
                  const nextLabel = current.label.trim() || (canAutofillName ? item.name.trim() : current.label);
                  const nextId =
                    isNew && !current.id.trim() && canAutofillName
                      ? slugify(item.name) || current.id
                      : current.id;
                  return {
                    ...current,
                    smartsheetId: item.id,
                    label: nextLabel,
                    id: nextId,
                  };
                });
                setSchema(null);
                setSchemaError("");
              }}
            />
          </div>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[color:var(--wsu-ink)]">Connection key</span>
            <input
              list="connection-keys"
              value={form.connectionKey ?? ""}
              onChange={(event) => update("connectionKey", event.target.value)}
              className="w-full rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-3"
            />
            <datalist id="connection-keys">
              {connectionOptions.map((key) => (
                <option key={key} value={key} />
              ))}
            </datalist>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[color:var(--wsu-ink)]">API base URL</span>
            <input
              value={form.apiBaseUrl ?? ""}
              onChange={(event) => update("apiBaseUrl", event.target.value)}
              className="w-full rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-3"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[color:var(--wsu-ink)]">Cache TTL seconds</span>
            <input
              type="number"
              value={form.cacheTtlSeconds ?? 120}
              onChange={(event) => update("cacheTtlSeconds", Number(event.target.value) || 0)}
              className="w-full rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-3"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[color:var(--wsu-ink)]">Fetch level</span>
            <input
              type="number"
              value={form.fetchOptions?.level ?? 2}
              onChange={(event) => updateFetchOption("level", Number(event.target.value) || 0)}
              className="w-full rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-3"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-4 text-sm text-[color:var(--wsu-muted)]">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.fetchOptions?.includeObjectValue ?? true}
              onChange={(event) => updateFetchOption("includeObjectValue", event.target.checked)}
            />
            Include objectValue
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.fetchOptions?.includeColumnOptions ?? true}
              onChange={(event) => updateFetchOption("includeColumnOptions", event.target.checked)}
            />
            Include column options
          </label>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] p-6 shadow-[0_16px_40px_rgba(35,31,32,0.06)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[color:var(--wsu-ink)]">Schema preview</h2>
            <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">
              Fetch the schema first. Use it to verify the connection, merge detected role groups, and enable column dropdowns in Role groups below.
            </p>
          </div>
        </div>

        {schemaError && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{schemaError}</p>}

        {schema ? (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-4 text-sm text-[color:var(--wsu-muted)]">
                <p>
                  <span className="font-semibold text-[color:var(--wsu-ink)]">Source:</span> {schema.name}
                </p>
                <p className="mt-1">
                  <span className="font-semibold text-[color:var(--wsu-ink)]">Columns:</span> {schema.columns.length}
                </p>
                <p className="mt-1">
                  <span className="font-semibold text-[color:var(--wsu-ink)]">Rows returned:</span> {schema.rowCount}
                </p>
              </div>
              <button
                type="button"
                onClick={() => startTransition(() => mergeDetectedRoleGroupsFromSchema())}
                className="rounded-full border border-[color:var(--wsu-border)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--wsu-ink)] hover:border-[color:var(--wsu-crimson)] hover:text-[color:var(--wsu-crimson)]"
              >
                Merge detected role groups
              </button>
            </div>
            {form.roleGroups && form.roleGroups.length > 0 && (
              <p className="text-xs text-[color:var(--wsu-muted)]">
                This source has {form.roleGroups.length} role group(s). Merge adds groups from column title patterns; adjust column mappings in{" "}
                <strong className="font-medium text-[color:var(--wsu-ink)]">Role groups</strong> next.
              </p>
            )}
            <div className="overflow-hidden rounded-2xl border border-[color:var(--wsu-border)] bg-white">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[color:var(--wsu-stone)]/70 text-[color:var(--wsu-muted)]">
                    <tr>
                      <th className="px-4 py-3">Title</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schema.columns.map((column) => (
                      <tr key={column.id} className="border-t border-[color:var(--wsu-border)]/60">
                        <td className="px-4 py-3 text-[color:var(--wsu-ink)]">{column.title}</td>
                        <td className="px-4 py-3">{column.type}</td>
                        <td className="px-4 py-3 font-mono text-xs">{column.id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-[color:var(--wsu-muted)]">No schema loaded yet.</p>
        )}
      </section>

      <section className="rounded-[1.75rem] border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] p-6 shadow-[0_16px_40px_rgba(35,31,32,0.06)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[color:var(--wsu-ink)]">Role groups</h2>
            <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">
              <strong className="font-medium text-[color:var(--wsu-ink)]">Fetch the schema first</strong> in{" "}
              <strong className="font-medium text-[color:var(--wsu-ink)]">Schema preview</strong> above — mapping and saves expect a loaded column list. Then map
              each person-slot to columns for name, email, phone, and optional campus. A group can have{" "}
              <strong className="font-medium text-[color:var(--wsu-ink)]">one slot</strong> (e.g. a single assessment contact) or many. Merge detected groups only
              finds titles like “Coordinator 1” / “Coordinator 1 Email”; use <strong className="font-medium text-[color:var(--wsu-ink)]">Add custom role group</strong>{" "}
              for other column names. To drop a one-slot group, use <strong className="font-medium text-[color:var(--wsu-ink)]">Remove group</strong> on that card
              (row <strong className="font-medium text-[color:var(--wsu-ink)]">Remove</strong> only removes a slot when you have two or more). For delimited groups,
              only enable trusted pairing when parallel columns stay in lockstep.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2 rounded-2xl border border-dashed border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/10 p-4">
          {!schemaLoaded ? (
            <p className="text-xs text-amber-900 underline decoration-amber-700/50">
              Load the schema in <strong className="font-medium">Schema preview</strong> before adding a role group — otherwise column mapping and save can fail.
            </p>
          ) : null}
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-xs">
              <span className="font-semibold text-[color:var(--wsu-ink)]">Add custom role group</span>
              <input
                type="text"
                value={customRoleGroupLabel}
                onChange={(e) => setCustomRoleGroupLabel(e.target.value)}
                placeholder="e.g. Assessment support contact"
                disabled={!schemaLoaded}
                className="rounded-xl border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm text-[color:var(--wsu-ink)] disabled:opacity-50"
              />
            </label>
            <button
              type="button"
              onClick={() => addCustomNumberedRoleGroup()}
              disabled={!schemaLoaded}
              title={
                schemaLoaded
                  ? undefined
                  : "Fetch schema in Schema preview first (Test + Fetch Schema or Fetch schema now)."
              }
              className="rounded-full border border-[color:var(--wsu-border)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--wsu-ink)] hover:border-[color:var(--wsu-crimson)] hover:text-[color:var(--wsu-crimson)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add with one slot
            </button>
          </div>
        </div>

        {form.roleGroups && form.roleGroups.length > 0 ? (
          <div className="mt-4 space-y-3">
            {!schemaLoaded ? (
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[color:var(--wsu-ink)]">Customize columns after loading the schema</p>
                    <p className="mt-1 text-xs leading-relaxed text-[color:var(--wsu-muted)]">
                      <strong className="text-[color:var(--wsu-ink)]">Slot IDs</strong> are editable now.{" "}
                      <strong className="text-[color:var(--wsu-ink)]">Name / email / phone</strong> use dropdowns only after
                      the column list is loaded (this page does not read it automatically). Click{" "}
                      <strong className="text-[color:var(--wsu-ink)]">Fetch schema now</strong> or{" "}
                      <strong className="text-[color:var(--wsu-ink)]">Test + Fetch Schema</strong> at the top, then map
                      columns here and <strong className="text-[color:var(--wsu-ink)]">Save source</strong>. Merge only adds
                      suggested groups from titles — you customize mappings in this table.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startTransition(() => {
                      void fetchSchema();
                    })}
                    className="shrink-0 rounded-full border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-900 hover:bg-sky-100"
                  >
                    Fetch schema now
                  </button>
                </div>
              </div>
            ) : null}
            {form.roleGroups.map((roleGroup) => {
              const attrs = getRoleGroupAttributeKeys(roleGroup);
              const attrSummary = attrs.length > 0 ? attrs.join(", ") : "none";
              const isDelimited = roleGroup.mode === "delimited_parallel";
              const delimitedAttrCount = isDelimited ? countDelimitedRoleAttributes(roleGroup.delimited) : 0;
              const canTrustPairing = isDelimited && delimitedAttrCount > 1;
              const isTrusted = roleGroup.delimited?.trustPairing === true;

              return (
                <article
                  key={roleGroup.id}
                  className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-[color:var(--wsu-ink)]">{roleGroup.label}</h3>
                        <span className="rounded-full bg-[color:var(--wsu-stone)]/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[color:var(--wsu-muted)]">
                          {roleGroup.mode === "numbered_slots" ? "Numbered slots" : "Delimited parallel"}
                        </span>
                        {roleGroup.mode === "numbered_slots" ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                            Safe by slot
                          </span>
                        ) : canTrustPairing ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              isTrusted ? "bg-emerald-50 text-emerald-800" : "bg-amber-100 text-amber-900"
                            }`}
                          >
                            {isTrusted ? "Trusted pairing" : "Read-only by default"}
                          </span>
                        ) : (
                          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-800">
                            Single attribute
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">
                        ID: <span className="font-mono">{roleGroup.id}</span>
                      </p>
                      <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">Configured attributes: {attrSummary}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Remove role group "${roleGroup.label}" from this source? Smartsheet columns are not deleted. Save source to persist.`,
                          )
                        ) {
                          return;
                        }
                        removeEntireRoleGroup(roleGroup.id);
                      }}
                      className="shrink-0 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-800 hover:bg-rose-100"
                    >
                      Remove group
                    </button>
                  </div>

                  {roleGroup.mode === "numbered_slots" ? (
                    <div className="mt-3 space-y-3">
                      <div className="overflow-x-auto rounded-xl border border-[color:var(--wsu-border)]/70">
                        <table className="min-w-full text-left text-xs">
                          <thead className="bg-[color:var(--wsu-stone)]/30 text-[color:var(--wsu-muted)]">
                            <tr>
                              <th className="px-3 py-2 align-bottom">Slot ID</th>
                              <th className="px-3 py-2 align-bottom">Name column</th>
                              <th className="px-3 py-2 align-bottom">Email column</th>
                              <th className="px-3 py-2 align-bottom">Phone column</th>
                              <th className="px-3 py-2 align-bottom">Campus column</th>
                              <th className="w-14 px-2 py-2 align-bottom" aria-label="Remove slot" />
                            </tr>
                          </thead>
                          <tbody>
                            {(roleGroup.slots ?? []).map((slot, slotIndex) => (
                              <tr
                                key={`${roleGroup.id}-slot-row-${slotIndex}`}
                                className="border-t border-[color:var(--wsu-border)]/60 text-[color:var(--wsu-ink)]"
                              >
                                <td className="px-3 py-2 align-top">
                                  <input
                                    value={slot.slot}
                                    onChange={(e) => setNumberedSlotId(roleGroup.id, slotIndex, e.target.value)}
                                    className="w-[6.5rem] rounded-lg border border-[color:var(--wsu-border)] bg-white px-2 py-1.5 font-mono text-xs"
                                    aria-label={`Slot ${slotIndex + 1} ID for ${roleGroup.label}`}
                                  />
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <RoleGroupColumnSelect
                                    htmlId={`${roleGroup.id}-name-${slotIndex}`}
                                    columns={schemaColumns}
                                    value={slot.name}
                                    schemaLoaded={schemaLoaded}
                                    accessibilityLabel={`Name column, slot ${slot.slot || String(slotIndex + 1)}, ${roleGroup.label}`}
                                    onChange={(sel) => updateNumberedSlotAttr(roleGroup.id, slotIndex, "name", sel)}
                                  />
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <RoleGroupColumnSelect
                                    htmlId={`${roleGroup.id}-email-${slotIndex}`}
                                    columns={schemaColumns}
                                    value={slot.email}
                                    schemaLoaded={schemaLoaded}
                                    accessibilityLabel={`Email column, slot ${slot.slot || String(slotIndex + 1)}, ${roleGroup.label}`}
                                    onChange={(sel) => updateNumberedSlotAttr(roleGroup.id, slotIndex, "email", sel)}
                                  />
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <RoleGroupColumnSelect
                                    htmlId={`${roleGroup.id}-phone-${slotIndex}`}
                                    columns={schemaColumns}
                                    value={slot.phone}
                                    schemaLoaded={schemaLoaded}
                                    accessibilityLabel={`Phone column, slot ${slot.slot || String(slotIndex + 1)}, ${roleGroup.label}`}
                                    onChange={(sel) => updateNumberedSlotAttr(roleGroup.id, slotIndex, "phone", sel)}
                                  />
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <RoleGroupColumnSelect
                                    htmlId={`${roleGroup.id}-campus-${slotIndex}`}
                                    columns={schemaColumns}
                                    value={slot.campus}
                                    schemaLoaded={schemaLoaded}
                                    accessibilityLabel={`Campus column, slot ${slot.slot || String(slotIndex + 1)}, ${roleGroup.label}`}
                                    onChange={(sel) => updateNumberedSlotAttr(roleGroup.id, slotIndex, "campus", sel)}
                                  />
                                </td>
                                <td className="px-2 py-2 align-top">
                                  <button
                                    type="button"
                                    onClick={() => removeNumberedSlot(roleGroup.id, slotIndex)}
                                    disabled={(roleGroup.slots ?? []).length <= 1}
                                    title={
                                      (roleGroup.slots ?? []).length <= 1
                                        ? "Keep at least one slot in the table, or use Remove group above to delete this entire role."
                                        : undefined
                                    }
                                    aria-label={`Remove slot ${slot.slot || String(slotIndex + 1)} from ${roleGroup.label}`}
                                    className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-medium text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {numberedSlotsHaveDuplicateIds(roleGroup.slots) ? (
                        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          Two or more rows use the same slot ID. Use a distinct ID per row so contributors and saves align
                          with the correct columns.
                        </p>
                      ) : null}
                      {(roleGroup.slots ?? []).length === 0 ? (
                        <p className="text-xs text-[color:var(--wsu-muted)]">
                          No slots yet. Add a slot and map columns, or use Merge detected role groups (schema section) from column title patterns.
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => addNumberedSlot(roleGroup.id)}
                        className="rounded-full border border-dashed border-[color:var(--wsu-border)] bg-white px-3 py-1.5 text-xs font-medium text-[color:var(--wsu-ink)] hover:border-[color:var(--wsu-crimson)]"
                      >
                        + Add slot
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-3">
                        {(["name", "email", "phone"] as const).map((attr) => (
                          <div
                            key={attr}
                            className="rounded-xl border border-[color:var(--wsu-border)]/70 bg-[color:var(--wsu-stone)]/10 px-3 py-3 text-xs"
                          >
                            <p className="font-semibold uppercase tracking-wide text-[color:var(--wsu-ink)]">{attr}</p>
                            <div className="mt-2">
                              <RoleGroupColumnSelect
                                htmlId={`${roleGroup.id}-delim-${attr}`}
                                columns={schemaColumns}
                                value={roleGroup.delimited?.[attr]?.source}
                                schemaLoaded={schemaLoaded}
                                accessibilityLabel={`Delimited ${attr} column, ${roleGroup.label}`}
                                onChange={(sel) => updateDelimitedAttrSelector(roleGroup.id, attr, sel)}
                              />
                            </div>
                            <label className="mt-2 block text-[10px] font-medium text-[color:var(--wsu-muted)]">
                              Delimiters (optional). Separate tokens with <span className="font-mono">|</span>. Use{" "}
                              <span className="font-mono">\n</span> for newline, <span className="font-mono">\|</span> for a literal
                              pipe.
                              <input
                                type="text"
                                value={roleGroupDelimitersToInputString(roleGroup.delimited?.[attr]?.delimiters)}
                                onChange={(e) => updateDelimitedAttrDelimiters(roleGroup.id, attr, e.target.value)}
                                placeholder="e.g. ,| ;| \\n"
                                disabled={!roleGroup.delimited?.[attr]?.source}
                                className="mt-1 w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-2 py-1.5 text-xs text-[color:var(--wsu-ink)] disabled:opacity-50"
                              />
                            </label>
                          </div>
                        ))}
                      </div>

                      {canTrustPairing ? (
                        <label className="flex items-start gap-3 rounded-xl border border-[color:var(--wsu-border)]/70 bg-[color:var(--wsu-stone)]/10 px-4 py-3 text-sm">
                          <input
                            type="checkbox"
                            checked={isTrusted}
                            onChange={(event) => updateRoleGroupTrustPairing(roleGroup.id, event.target.checked)}
                            className="mt-1"
                          />
                          <span>
                            <span className="block font-medium text-[color:var(--wsu-ink)]">
                              Trust positional pairing for this delimited role group
                            </span>
                            <span className="mt-1 block text-xs text-[color:var(--wsu-muted)]">
                              Enable this only when the name, email, and phone columns remain in matching order in Smartsheet. If unchecked, the group stays
                              display-only in contributor editing.
                            </span>
                          </span>
                        </label>
                      ) : (
                        <p className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs text-sky-900">
                          This delimited role group uses one attribute only, so there is no cross-column pairing override to manage.
                        </p>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm text-[color:var(--wsu-muted)]">
            No role groups yet. Use <strong className="font-medium text-[color:var(--wsu-ink)]">Add custom role group</strong> above for a single-person role or
            any columns that do not match auto-detect patterns. Or load schema and use{" "}
            <strong className="font-medium text-[color:var(--wsu-ink)]">Merge detected role groups</strong> for “Name 1” / “Name 1 Email” style titles.
          </p>
        )}
      </section>
    </div>
  );
}
