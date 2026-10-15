"use client";

import { useState, useTransition } from "react";
import { Button, Card } from "@/components/admin/WorkspacePrimitives";

type ImportScope = "registered" | "all";

type ImportSummary = {
  scope?: ImportScope;
  sheetsProcessed: number;
  reportsProcessed: number;
  rowsAdded: number;
  rowsSkipped: number;
  automationsAdded: number;
  automationsSkipped: number;
  attachmentsAdded: number;
  discussionsAdded: number;
  errors: string[];
};

export function SmartsheetImportCard() {
  const [scope, setScope] = useState<ImportScope>("registered");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [pending, startTransition] = useTransition();

  function runImport() {
    setError("");
    setNotice("");
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/smartsheet/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          summary?: ImportSummary;
        };
        if (!res.ok) {
          setError(data.error ?? "Import failed.");
          return;
        }
        setSummary(data.summary ?? null);
        const usedScope = data.summary?.scope ?? scope;
        setNotice(
          usedScope === "registered"
            ? "Import finished for registered sources. You can turn the Smartsheet API off and keep using the imported copy."
            : "Import finished for the full Smartsheet catalog. You can turn the Smartsheet API off and keep using the imported copy.",
        );
      } catch {
        setError("Import failed.");
      }
    });
  }

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-ink">Import Smartsheet data</p>
            <p className="text-[12.5px] leading-5 text-sub">
              Copy sheets, reports, rows, attachments, discussions, and automation rules into this
              app&apos;s database. Requires the Smartsheet API to be on for the import only. Later
              imports add missing data and do not overwrite cells you changed here.
            </p>
          </div>

          <fieldset className="space-y-2" disabled={pending}>
            <legend className="sr-only">Import scope</legend>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-ink">
              <input
                type="radio"
                name="import-scope"
                className="mt-1"
                checked={scope === "registered"}
                onChange={() => setScope("registered")}
              />
              <span>
                <span className="font-medium">Registered sources only</span>
                <span className="mt-0.5 block text-[12.5px] text-sub">
                  Import sheet IDs already listed under Sources. Skips the rest of the Smartsheet account.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-ink">
              <input
                type="radio"
                name="import-scope"
                className="mt-1"
                checked={scope === "all"}
                onChange={() => setScope("all")}
              />
              <span>
                <span className="font-medium">Import all</span>
                <span className="mt-0.5 block text-[12.5px] text-sub">
                  Pull every sheet and report visible in the Smartsheet catalog.
                </span>
              </span>
            </label>
          </fieldset>

          {summary ? (
            <p className="text-xs text-mist">
              Scope {summary.scope === "all" ? "all" : "registered"} · Sheets {summary.sheetsProcessed} ·
              Reports {summary.reportsProcessed} · Rows added {summary.rowsAdded} · Rows left untouched{" "}
              {summary.rowsSkipped}
              {summary.automationsAdded ? ` · Automations added ${summary.automationsAdded}` : ""}
              {summary.errors.length ? ` · ${summary.errors.length} errors` : ""}
            </p>
          ) : null}
          {notice ? <p className="text-xs text-ink">{notice}</p> : null}
          {error ? <p className="text-xs text-crimson">{error}</p> : null}
          {summary?.errors?.length ? (
            <ul className="mt-1 max-h-24 list-disc overflow-auto pl-4 text-xs text-crimson">
              {summary.errors.slice(0, 8).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <Button variant="primary" disabled={pending} onClick={runImport} className="shrink-0">
          {pending
            ? "Importing…"
            : scope === "registered"
              ? "Import registered"
              : "Import all"}
        </Button>
      </div>
    </Card>
  );
}
