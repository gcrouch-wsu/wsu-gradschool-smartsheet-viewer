"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type FormSheetOption = { id: string; name: string };

interface FormSheetPickerProps {
  forms: FormSheetOption[];
  selectedSheetId: string;
  onSheetChange: (sheetId: string) => void;
  /** Visible label; omit for screen-reader-only default. */
  label?: string;
  labelHtmlFor?: string;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  inputId?: string;
  listboxId?: string;
  disabled?: boolean;
}

/** Searchable form-sheet combobox (same pattern as Views Smartsheet resource picker). */
export function FormSheetPicker({
  forms,
  selectedSheetId,
  onSheetChange,
  label = "Form sheet",
  labelHtmlFor,
  placeholder = "Search by name or ID…",
  emptyMessage = "No matching forms.",
  className = "relative min-w-0 flex-1 sm:w-64 sm:flex-none",
  inputId = "forms-sheet-picker-input",
  listboxId = "forms-sheet-picker-listbox",
  disabled = false,
}: FormSheetPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const labelFor = labelHtmlFor ?? inputId;
  const showVisibleLabel = Boolean(labelHtmlFor);

  const selected = useMemo(
    () => forms.find((form) => form.id === selectedSheetId) ?? null,
    [forms, selectedSheetId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return forms;
    return forms.filter(
      (form) => form.name.toLowerCase().includes(q) || form.id.toLowerCase().includes(q),
    );
  }, [forms, query]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const displayValue = open ? query : selected ? selected.name : "";

  return (
    <div className={className} ref={rootRef}>
      <label className={showVisibleLabel ? "mb-1 block text-xs text-[color:var(--wsu-muted)]" : "sr-only"} htmlFor={labelFor}>
        {label}
      </label>
      <input
        id={inputId}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        value={displayValue}
        disabled={disabled}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (disabled) return;
          setOpen(true);
          if (selected) setQuery("");
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            if (open) {
              event.stopPropagation();
              setOpen(false);
              setQuery("");
              (event.target as HTMLInputElement).blur();
            }
          }
        }}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm font-medium text-[color:var(--wsu-ink)] focus:outline-none focus:ring-1 focus:ring-wsu-crimson disabled:opacity-60"
      />

      {open && !disabled ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-[color:var(--wsu-border)] bg-white py-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-[color:var(--wsu-muted)]">{emptyMessage}</li>
          ) : (
            filtered.map((form) => {
              const isActive = form.id === selectedSheetId;
              return (
                <li key={form.id} role="option" aria-selected={isActive}>
                  <button
                    type="button"
                    className={[
                      "flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-[color:var(--wsu-stone)]",
                      isActive ? "bg-wsu-crimson/5 text-wsu-crimson" : "text-[color:var(--wsu-ink)]",
                    ].join(" ")}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onSheetChange(form.id);
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{form.name}</span>
                    <span className="shrink-0 text-xs text-[color:var(--wsu-muted)]">ID {form.id}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
