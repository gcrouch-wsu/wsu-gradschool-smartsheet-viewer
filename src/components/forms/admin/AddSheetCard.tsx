"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconPlus } from "@/components/forms/icons";

interface SheetOption {
  id: number;
  name: string;
}

interface AddSheetCardProps {
  sheetsLive: boolean;
  addableCount: number;
  sheets: SheetOption[];
  addId: string;
  onAddIdChange: (value: string) => void;
  onAdd: () => void;
  sheetsError: string;
  sheetsLoading?: boolean;
  addMsg: { ok: boolean; text: string } | null;
  allSheetsRegistered: boolean;
}

export function AddSheetCard({
  sheetsLive,
  addableCount,
  sheets,
  addId,
  onAddIdChange,
  onAdd,
  sheetsError,
  sheetsLoading = false,
  addMsg,
  allSheetsRegistered,
}: AddSheetCardProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = "add-sheet-picker-listbox";

  const selected = useMemo(
    () => sheets.find((sheet) => String(sheet.id) === addId) ?? null,
    [sheets, addId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sheets;
    return sheets.filter(
      (sheet) => sheet.name.toLowerCase().includes(q) || String(sheet.id).includes(q),
    );
  }, [sheets, query]);

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
      : "";

  return (
    <div className="flex h-full flex-col rounded-xl border border-[color:var(--wsu-border)] bg-white p-4">
      <h2 className="text-sm font-medium text-[color:var(--wsu-ink)]">Add existing sheet</h2>
      <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">
        {sheetsLoading
          ? "Loading sheets from Smartsheet…"
          : sheetsLive
            ? `${addableCount} sheet${addableCount === 1 ? "" : "s"} available. Adds to the shared Sources catalog and activates Forms.`
            : "Demo mode — showing sample sheets only."}
      </p>

      <div className="mt-4 flex flex-1 flex-col gap-3">
        <div className="relative" ref={rootRef}>
          <label htmlFor="addSheet" className="sr-only">
            Select a sheet
          </label>
          <input
            id="addSheet"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            value={displayValue}
            disabled={sheetsLoading}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              if (sheetsLoading) return;
              setOpen(true);
              if (selected) setQuery("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                setQuery("");
                (event.target as HTMLInputElement).blur();
              }
            }}
            placeholder={sheetsLoading ? "Loading sheets…" : "Search sheets by name or ID…"}
            className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm text-[color:var(--wsu-ink)] focus:border-wsu-crimson focus:outline-none focus:ring-1 focus:ring-wsu-crimson disabled:opacity-60"
          />

          {open && !sheetsLoading ? (
            <ul
              id={listboxId}
              role="listbox"
              className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-[color:var(--wsu-border)] bg-white py-1 shadow-lg"
            >
              {filtered.length === 0 ? (
                <li className="px-3 py-2.5 text-sm text-[color:var(--wsu-muted)]">No matching sheets.</li>
              ) : (
                filtered.slice(0, 100).map((sheet) => {
                  const isActive = String(sheet.id) === addId;
                  return (
                    <li key={sheet.id} role="option" aria-selected={isActive}>
                      <button
                        type="button"
                        className={[
                          "flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-[color:var(--wsu-stone)]",
                          isActive ? "bg-wsu-crimson/5 text-wsu-crimson" : "text-[color:var(--wsu-ink)]",
                        ].join(" ")}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          onAddIdChange(String(sheet.id));
                          setQuery("");
                          setOpen(false);
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate font-medium">{sheet.name}</span>
                        <span className="shrink-0 text-xs text-[color:var(--wsu-muted)]">ID {sheet.id}</span>
                      </button>
                    </li>
                  );
                })
              )}
              {filtered.length > 100 ? (
                <li className="border-t border-[color:var(--wsu-border)] px-3 py-2 text-xs text-[color:var(--wsu-muted)]">
                  Showing first 100 matches — type to narrow the list.
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onAdd}
          disabled={!addId}
          className="mt-auto flex w-full items-center justify-center gap-1.5 rounded-lg border border-[color:var(--wsu-border)] bg-white py-2.5 text-sm font-medium text-[color:var(--wsu-ink)] hover:bg-[color:var(--wsu-stone)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <IconPlus className="h-4 w-4" />
          Add sheet
        </button>
      </div>

      {sheetsError ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{sheetsError}</p>
      ) : null}
      {!sheetsError && allSheetsRegistered ? (
        <p className="mt-3 text-xs text-[color:var(--wsu-muted)]">All available sheets are already in your forms list.</p>
      ) : null}
      {addMsg ? (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-xs ${addMsg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}
        >
          {addMsg.text}
        </p>
      ) : null}
    </div>
  );
}
