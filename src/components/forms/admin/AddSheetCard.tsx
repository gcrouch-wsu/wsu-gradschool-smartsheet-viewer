"use client";

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
  addMsg,
  allSheetsRegistered,
}: AddSheetCardProps) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-[color:var(--wsu-border)] bg-white p-4">
      <h2 className="text-sm font-medium text-[color:var(--wsu-ink)]">Add existing sheet</h2>
      <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">
        {sheetsLive
          ? `${addableCount} sheet${addableCount === 1 ? "" : "s"} available. Adds to the shared Sources catalog and activates Forms.`
          : "Demo mode — showing sample sheets only."}
      </p>

      <div className="mt-4 flex flex-1 flex-col gap-3">
        <div>
          <label htmlFor="addSheet" className="sr-only">
            Select a sheet
          </label>
          <select
            id="addSheet"
            value={addId}
            onChange={(e) => onAddIdChange(e.target.value)}
            className="w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm text-[color:var(--wsu-ink)] focus:border-wsu-crimson focus:outline-none focus:ring-1 focus:ring-wsu-crimson"
          >
            <option value="">Select a sheet…</option>
            {sheets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} (ID {s.id})
              </option>
            ))}
          </select>
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
