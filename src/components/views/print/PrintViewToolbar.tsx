"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { publicInteractiveHref } from "@/lib/public-view-href";

export type PrintColumnPickerRow = { key: string; label: string; heading?: boolean };

function deriveSelectedOptional(searchParams: Pick<URLSearchParams, "get">, optionalKeys: string[]) {
  const fromUrl = searchParams.get("cols");
  if (!fromUrl) {
    return [...optionalKeys];
  }

  const picked = fromUrl
    .split(",")
    .map((s) => s.trim())
    .filter((k) => optionalKeys.includes(k));

  return picked.length > 0 ? picked : [...optionalKeys];
}

function PrintViewToolbarInner({
  slug,
  viewId,
  singlePublishedView,
  columnOptions,
  initialSelectedOptional,
  initialCompact,
  onApply,
}: {
  slug: string;
  viewId: string;
  singlePublishedView: boolean;
  columnOptions?: PrintColumnPickerRow[];
  initialSelectedOptional: string[];
  initialCompact: boolean;
  onApply: (selectedOptional: string[], compactLocal: boolean) => void;
}) {
  const [selectedOptional, setSelectedOptional] = useState<string[]>(() => initialSelectedOptional);
  const [compactLocal, setCompactLocal] = useState(initialCompact);
  const showPicker = Boolean(columnOptions && columnOptions.length > 0);

  return (
    <div className="no-print mb-8 flex flex-col gap-4 border-b border-[color:var(--wsu-border)] pb-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={publicInteractiveHref(slug, viewId, singlePublishedView)} className="link-pill-muted px-4 py-2 text-sm">
          Back to interactive view
        </Link>
        <button type="button" onClick={() => window.print()} className="view-control-active px-4 py-2 text-sm font-medium">
          Print or save as PDF...
        </button>
      </div>

      {showPicker ? (
        <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] p-4 text-sm">
          <p className="font-medium text-[color:var(--wsu-ink)]">Print columns</p>
          <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">
            Uncheck fields you donâ€¦t need so the table stays wider. The row title column always prints.
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {columnOptions!.map((col) => {
              const locked = Boolean(col.heading);
              const checked = locked || selectedOptional.includes(col.key);
              const onlyOptionalLeft =
                !locked && selectedOptional.length === 1 && selectedOptional[0] === col.key;
              return (
                <li key={col.key} className="flex items-start gap-2">
                  <input
                    id={`print-col-${col.key}`}
                    type="checkbox"
                    className="mt-1"
                    checked={checked}
                    disabled={locked || onlyOptionalLeft}
                    title={onlyOptionalLeft ? "At least one data column must stay selected for print" : undefined}
                    onChange={(e) => {
                      if (locked) {
                        return;
                      }
                      if (e.target.checked) {
                        setSelectedOptional((prev) => (prev.includes(col.key) ? prev : [...prev, col.key]));
                      } else {
                        setSelectedOptional((prev) => {
                          const next = prev.filter((k) => k !== col.key);
                          return next.length === 0 ? prev : next;
                        });
                      }
                    }}
                  />
                  <label htmlFor={`print-col-${col.key}`} className={locked ? "text-[color:var(--wsu-muted)]" : ""}>
                    {col.label}
                    {locked ? <span className="ml-1 text-[10px] text-[color:var(--wsu-muted)]">(always)</span> : null}
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={compactLocal}
                onChange={(e) => setCompactLocal(e.target.checked)}
              />
              Compact type (smaller text for dense PDFs)
            </label>
            <button
              type="button"
              onClick={() => onApply(selectedOptional, compactLocal)}
              className="rounded-full bg-[color:var(--wsu-crimson)] px-4 py-1.5 text-xs font-medium text-white hover:bg-[color:var(--wsu-crimson-dark)]"
            >
              Apply to preview
            </button>
          </div>
        </div>
      ) : null}

      <p className="text-xs text-[color:var(--wsu-muted)]">
        Opens the browser print dialog. Choose &quot;Save as PDF&quot; to download. Landscape table layout; base print sizes are in{" "}
        <code className="rounded bg-black/[0.04] px-1 py-0.5 text-[10px]">src/config/print-export-defaults.json</code> (not the page
        theme). Use compact type above to fit more on one page when you use fewer columns.
      </p>
    </div>
  );
}

export function PrintViewToolbar({
  slug,
  viewId,
  singlePublishedView,
  columnOptions,
  compact: compactActive,
}: {
  slug: string;
  viewId: string;
  singlePublishedView: boolean;
  columnOptions?: PrintColumnPickerRow[];
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const optionalKeys = useMemo(
    () => columnOptions?.filter((c) => !c.heading).map((c) => c.key) ?? [],
    [columnOptions],
  );
  const initialSelectedOptional = useMemo(
    () => deriveSelectedOptional(searchParams, optionalKeys),
    [optionalKeys, searchParams],
  );
  const initialCompact = searchParams.get("compact") === "1" || Boolean(compactActive);
  const toolbarStateKey = `${viewId}|${searchParams.toString()}|${optionalKeys.join("|")}`;

  function applyPrintSettings(selectedOptional: string[], compactLocal: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (singlePublishedView) {
      params.delete("view");
    } else {
      params.set("view", viewId);
    }

    const allSelected =
      selectedOptional.length === optionalKeys.length &&
      optionalKeys.every((k) => selectedOptional.includes(k));

    if (allSelected) {
      params.delete("cols");
    } else {
      params.set("cols", selectedOptional.join(","));
    }

    if (compactLocal) {
      params.set("compact", "1");
    } else {
      params.delete("compact");
    }

    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <PrintViewToolbarInner
      key={toolbarStateKey}
      slug={slug}
      viewId={viewId}
      singlePublishedView={singlePublishedView}
      columnOptions={columnOptions}
      initialSelectedOptional={initialSelectedOptional}
      initialCompact={initialCompact}
      onApply={applyPrintSettings}
    />
  );
}
