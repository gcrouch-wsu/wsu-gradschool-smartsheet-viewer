"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PdfPlacement } from "@/lib/forms/pdf-mapping-types";

type FieldOption = { columnTitle: string; label?: string };
type PageSize = { width: number; height: number };

const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 16;
const DEFAULT_FONT = 10;

function labelFor(columnTitle: string, options: FieldOption[]) {
  return options.find((option) => option.columnTitle === columnTitle)?.label?.trim() || columnTitle;
}

function clampBox(x: number, y: number, width: number, height: number, page: PageSize) {
  return {
    x: Math.min(Math.max(0, page.width - width), Math.max(0, x)),
    y: Math.min(Math.max(0, page.height - height), Math.max(0, y)),
  };
}

export function PdfPlacementCanvas({
  sheetId,
  templateKey,
  fieldOptions,
  placements,
  onChange,
}: {
  sheetId: string;
  templateKey: number;
  fieldOptions: FieldOption[];
  placements: PdfPlacement[];
  onChange: (placements: PdfPlacement[]) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const placementsRef = useRef(placements);
  const onChangeRef = useRef(onChange);
  const pageSizeRef = useRef<PageSize | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [pageSize, setPageSize] = useState<PageSize | null>(null);
  const [display, setDisplay] = useState<PageSize | null>(null);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [dragging, setDragging] = useState(false);

  placementsRef.current = placements;
  onChangeRef.current = onChange;
  pageSizeRef.current = pageSize;

  function speak(text: string) {
    setAnnounce("");
    window.setTimeout(() => setAnnounce(text), 30);
  }

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPageIndex(0);
    void (async () => {
      try {
        const response = await fetch(
          `/api/forms/builder/pdf-mapping/template?sheetId=${encodeURIComponent(sheetId)}&v=${templateKey}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Could not open the uploaded PDF.");
        const data = new Uint8Array(await response.arrayBuffer());
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
        if (cancelled) {
          await doc.destroy();
          return;
        }
        docRef.current?.destroy();
        docRef.current = doc;
        setNumPages(doc.numPages);
        setLoading(false);
      } catch (err) {
        if (cancelled || controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Could not open the uploaded PDF.");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [sheetId, templateKey]);

  useEffect(() => {
    return () => {
      docRef.current?.destroy();
      docRef.current = null;
    };
  }, []);

  useEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!doc || !canvas || !stage || loading) return;
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    let lastWidth = 0;
    const draw = () => {
      const cssWidth = Math.max(1, Math.round(stage.clientWidth));
      if (Math.abs(cssWidth - lastWidth) < 2) return;
      lastWidth = cssWidth;
      void (async () => {
        const pageNumber = Math.min(doc.numPages, pageIndex + 1);
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const pixelRatio = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: (cssWidth / base.width) * pixelRatio });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = "100%";
        canvas.style.height = "auto";
        const context = canvas.getContext("2d");
        if (!context) return;
        const size = { width: base.width, height: base.height };
        pageSizeRef.current = size;
        setPageSize(size);
        setDisplay({ width: cssWidth, height: viewport.height / pixelRatio });
        task = page.render({ canvasContext: context, canvas: null, viewport });
        try {
          await task.promise;
        } catch {
          // A cancelled render throws when the page changes.
        }
      })();
    };
    draw();
    const observer = new ResizeObserver(() => {
      const cssWidth = Math.max(1, Math.round(stage.clientWidth));
      if (Math.abs(cssWidth - lastWidth) < 2) return;
      task?.cancel();
      draw();
    });
    observer.observe(stage);
    return () => {
      cancelled = true;
      task?.cancel();
      observer.disconnect();
    };
  }, [loading, pageIndex, numPages, templateKey]);

  function upsert(next: PdfPlacement) {
    onChange([...placementsRef.current.filter((item) => item.columnTitle !== next.columnTitle), next]);
  }

  function placeSelected(pdfX: number, pdfY: number) {
    const page = pageSizeRef.current;
    const columnTitle = selected;
    if (!page || !columnTitle) {
      speak("Choose a form field, then click the page.");
      return;
    }
    const existing = placementsRef.current.find((item) => item.columnTitle === columnTitle);
    const width = existing?.width ?? DEFAULT_WIDTH;
    const height = existing?.height ?? DEFAULT_HEIGHT;
    const spot = clampBox(pdfX, pdfY - height, width, height, page);
    upsert({
      id: existing?.id ?? `place:${columnTitle}`,
      columnTitle,
      page: pageIndex,
      x: spot.x,
      y: spot.y,
      width,
      height,
      fontSize: existing?.fontSize ?? DEFAULT_FONT,
    });
    speak(`${labelFor(columnTitle, fieldOptions)} placed on the page`);
  }

  function movePlacement(placement: PdfPlacement, x: number, y: number) {
    const page = pageSizeRef.current;
    if (!page) return;
    const spot = clampBox(x, y, placement.width, placement.height, page);
    upsert({ ...placement, page: pageIndex, x: spot.x, y: spot.y });
  }

  function startDrag(event: React.PointerEvent<HTMLButtonElement>, placement: PdfPlacement) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("[data-placement-remove]")) return;
    event.preventDefault();
    const originX = event.clientX;
    const originY = event.clientY;
    const startX = placement.x;
    const startY = placement.y;
    let moved = false;
    setDragging(true);
    const move = (pointer: PointerEvent) => {
      if (pointer.pointerId !== event.pointerId) return;
      const dx = pointer.clientX - originX;
      const dy = pointer.clientY - originY;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true;
      const rect = canvasRef.current?.getBoundingClientRect();
      const page = pageSizeRef.current;
      if (!rect || !page || rect.width <= 0 || rect.height <= 0) return;
      movePlacement(placement, startX + (dx / rect.width) * page.width, startY - (dy / rect.height) * page.height);
    };
    const end = (pointer: PointerEvent) => {
      if (pointer.pointerId !== event.pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      setDragging(false);
      if (moved) speak(`${labelFor(placement.columnTitle, fieldOptions)} moved on the page`);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  const onPage = placements.filter((item) => item.page === pageIndex);

  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs leading-5 text-[color:var(--wsu-muted)]">
        Choose a form field, then click the page where that answer should appear. Drag a box to move it. Arrow keys move the selected box, and Shift moves farther.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[12rem] flex-1 text-xs text-[color:var(--wsu-muted)]">
          Form field
          <select
            className="mt-1 w-full rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm text-[color:var(--wsu-ink)]"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            <option value="">Choose a form field</option>
            {fieldOptions.map((option) => (
              <option key={option.columnTitle} value={option.columnTitle}>
                {option.label?.trim() || option.columnTitle}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm font-medium text-[color:var(--wsu-ink)] hover:bg-[color:var(--wsu-stone)] disabled:opacity-50"
          disabled={!selected || !pageSize}
          onClick={() => {
            const page = pageSizeRef.current;
            if (page) placeSelected(48, page.height - 36);
          }}
        >
          Place on this page
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg border border-[color:var(--wsu-border)] bg-white px-2.5 py-2 text-sm text-[color:var(--wsu-ink)] disabled:opacity-40"
            disabled={pageIndex <= 0}
            onClick={() => setPageIndex((page) => Math.max(0, page - 1))}
          >
            Previous page
          </button>
          <span className="px-1 text-xs text-[color:var(--wsu-muted)]">
            {numPages ? `Page ${pageIndex + 1} of ${numPages}` : "Page"}
          </span>
          <button
            type="button"
            className="rounded-lg border border-[color:var(--wsu-border)] bg-white px-2.5 py-2 text-sm text-[color:var(--wsu-ink)] disabled:opacity-40"
            disabled={!numPages || pageIndex >= numPages - 1}
            onClick={() => setPageIndex((page) => page + 1)}
          >
            Next page
          </button>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      {error ? <p className="text-sm text-[color:var(--product-err)]">{error}</p> : null}
      <div ref={stageRef} className="relative overflow-hidden rounded-lg border border-[color:var(--wsu-border)] bg-white">
        <canvas
          ref={canvasRef}
          className="block w-full"
          onPointerDown={(event) => {
            if (event.button !== 0 || !pageSize) return;
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect || rect.width <= 0 || rect.height <= 0) return;
            const x = ((event.clientX - rect.left) / rect.width) * pageSize.width;
            const y = pageSize.height - ((event.clientY - rect.top) / rect.height) * pageSize.height;
            placeSelected(x, y);
          }}
        />
        {loading ? (
          <p className="absolute inset-x-0 top-3 text-center text-xs text-[color:var(--wsu-muted)]">Opening PDF…</p>
        ) : null}
        {pageSize && display
          ? onPage.map((placement) => {
              const label = labelFor(placement.columnTitle, fieldOptions);
              const left = (placement.x / pageSize.width) * display.width;
              const top = ((pageSize.height - placement.y - placement.height) / pageSize.height) * display.height;
              const width = (placement.width / pageSize.width) * display.width;
              const height = (placement.height / pageSize.height) * display.height;
              return (
                <div key={placement.columnTitle} className="absolute" style={{ left, top, width, height }}>
                  <button
                    type="button"
                    className={`absolute inset-0 truncate rounded border border-wsu-crimson/70 bg-wsu-crimson/10 px-1 text-left text-[10px] font-medium text-[color:var(--wsu-ink)] ${
                      dragging ? "cursor-grabbing" : "cursor-grab"
                    } touch-none select-none [-webkit-user-select:none]`}
                    aria-label={`${label} on the PDF. Use arrow keys to move.`}
                    onPointerDown={(event) => startDrag(event, placement)}
                    onKeyDown={(event) => {
                      const step = event.shiftKey ? 12 : 4;
                      if (event.key === "ArrowLeft") movePlacement(placement, placement.x - step, placement.y);
                      else if (event.key === "ArrowRight") movePlacement(placement, placement.x + step, placement.y);
                      else if (event.key === "ArrowUp") movePlacement(placement, placement.x, placement.y + step);
                      else if (event.key === "ArrowDown") movePlacement(placement, placement.x, placement.y - step);
                      else return;
                      event.preventDefault();
                      speak(`${label} moved on the page`);
                    }}
                  >
                    {label}
                  </button>
                  <button
                    type="button"
                    data-placement-remove
                    className="absolute -right-1 -top-1 z-10 rounded bg-white px-1 text-[10px] leading-4 text-[color:var(--wsu-ink)] shadow"
                    aria-label={`Remove ${label}`}
                    onClick={() => {
                      onChange(placements.filter((item) => item.columnTitle !== placement.columnTitle));
                      speak(`${label} removed`);
                    }}
                  >
                    Remove
                  </button>
                </div>
              );
            })
          : null}
      </div>
      {placements.length ? (
        <ul className="space-y-1 text-xs text-[color:var(--wsu-muted)]">
          {placements.map((placement) => {
            const label = labelFor(placement.columnTitle, fieldOptions);
            return (
              <li key={placement.columnTitle} className="flex flex-wrap items-center gap-2">
                <span className="text-[color:var(--wsu-ink)]">{label}</span>
                <span>Page {placement.page + 1}</span>
                <button type="button" className="underline" onClick={() => setPageIndex(placement.page)}>
                  Show
                </button>
                <button
                  type="button"
                  className="underline"
                  onClick={() => {
                    onChange(placements.filter((item) => item.columnTitle !== placement.columnTitle));
                    speak(`${label} removed`);
                  }}
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
