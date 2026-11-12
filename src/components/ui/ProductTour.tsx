"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ensureOverlayPolyfills } from "@/lib/overlay-polyfills";

export type ProductTourStep = {
  id: string;
  /** CSS selector for the highlight target (e.g. `[data-tour="vb-save"]`). */
  target: string;
  title: string;
  body: string;
};

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const SPOTLIGHT_PADDING = 8;
const TARGET_WAIT_ATTEMPTS = 24;
const TARGET_WAIT_MS = 50;
const TOUR_ANCHOR = "--product-tour-target";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function openContainingDetails(el: Element): void {
  let node: Element | null = el;
  while (node) {
    if (node instanceof HTMLDetailsElement && !node.open) {
      node.open = true;
    }
    node = node.parentElement;
  }
}

function clearTourAnchor() {
  for (const node of document.querySelectorAll("[data-tour-anchor]")) {
    if (!(node instanceof HTMLElement)) continue;
    node.style.removeProperty("anchor-name");
    node.removeAttribute("data-tour-anchor");
  }
}

function measureTarget(selector: string): { rect: SpotlightRect; element: HTMLElement } | null {
  const nodes = document.querySelectorAll(selector);
  for (const el of nodes) {
    if (!(el instanceof HTMLElement)) continue;
    openContainingDetails(el);
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    el.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
    const after = el.getBoundingClientRect();
    if (after.width === 0 && after.height === 0) continue;
    return {
      element: el,
      rect: {
        top: after.top - SPOTLIGHT_PADDING,
        left: after.left - SPOTLIGHT_PADDING,
        width: after.width + SPOTLIGHT_PADDING * 2,
        height: after.height + SPOTLIGHT_PADDING * 2,
      },
    };
  }
  return null;
}

async function waitForTarget(selector: string) {
  for (let i = 0; i < TARGET_WAIT_ATTEMPTS; i++) {
    const found = measureTarget(selector);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, TARGET_WAIT_MS));
  }
  return null;
}

export function ProductTour({
  open,
  steps,
  stepIndex,
  onStepIndexChange,
  onClose,
  onComplete,
}: {
  open: boolean;
  steps: ProductTourStep[];
  stepIndex: number;
  onStepIndexChange: (index: number) => void;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [missing, setMissing] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const focusedStepRef = useRef<string | null>(null);
  const inertedRef = useRef<HTMLElement[]>([]);
  const titleId = useId();
  const bodyId = useId();
  const resolveGen = useRef(0);

  const step = steps[stepIndex] ?? null;
  const total = steps.length;
  const isFirst = stepIndex <= 0;
  const isLast = stepIndex >= total - 1;

  const setPageInert = useCallback((active: boolean, target?: HTMLElement | null) => {
    for (const el of inertedRef.current) el.inert = false;
    inertedRef.current = [];
    if (!active || !target) return;
    const dialog = dialogRef.current;
    const spot = spotRef.current;
    const keep = new Set<HTMLElement>();
    let node: HTMLElement | null = target;
    while (node && node !== document.body) {
      keep.add(node);
      node = node.parentElement;
    }
    const next: HTMLElement[] = [];
    const walk = (parent: HTMLElement) => {
      for (const child of Array.from(parent.children)) {
        if (!(child instanceof HTMLElement)) continue;
        if (child === dialog || child === spot) continue;
        if (keep.has(child)) {
          walk(child);
          continue;
        }
        child.inert = true;
        next.push(child);
      }
    };
    walk(document.body);
    inertedRef.current = next;
  }, []);

  useEffect(() => {
    setMounted(true);
    void ensureOverlayPolyfills();
  }, []);

  const refreshPosition = useCallback(async () => {
    if (!open || !step) {
      setSpotlight(null);
      return;
    }
    const gen = ++resolveGen.current;
    setMissing(false);
    const found = await waitForTarget(step.target);
    if (gen !== resolveGen.current) return;
    if (!found) {
      setSpotlight(null);
      setMissing(true);
      return;
    }
    setMissing(false);
    setSpotlight(found.rect);
    clearTourAnchor();
    found.element.style.setProperty("anchor-name", TOUR_ANCHOR);
    found.element.setAttribute("data-tour-anchor", "");
    targetRef.current = found.element;
    const dialog = dialogRef.current;
    if (dialog && !dialog.matches(":popover-open")) {
      try {
        dialog.showPopover();
      } catch {
        /* already open */
      }
    }
    setPageInert(true, found.element);
    const focusKey = `${step.id}:${stepIndex}`;
    if (focusedStepRef.current !== focusKey) {
      focusedStepRef.current = focusKey;
      nextRef.current?.focus();
    }
  }, [open, setPageInert, step, stepIndex]);

  useEffect(() => {
    if (!open) return;
    void refreshPosition();
  }, [open, stepIndex, refreshPosition]);

  useEffect(() => {
    if (!open) return;
    function onResize() {
      void refreshPosition();
    }
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, refreshPosition]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) return;
    const dialog = dialogRef.current;
    if (dialog?.matches(":popover-open")) dialog.hidePopover();
    focusedStepRef.current = null;
    setPageInert(false);
    clearTourAnchor();
    const target = targetRef.current;
    targetRef.current = null;
    target?.focus();
  }, [open, setPageInert]);

  useEffect(() => {
    if (!open || !missing || !step) return;
    if (isLast) {
      onComplete();
      return;
    }
    const timer = setTimeout(() => onStepIndexChange(stepIndex + 1), 0);
    return () => clearTimeout(timer);
  }, [open, missing, step, isLast, stepIndex, onStepIndexChange, onComplete]);

  if (!mounted || total === 0) return null;

  const reduced = prefersReducedMotion();

  return createPortal(
    <>
      {open && step ? (
        <div
          ref={spotRef}
          data-tour-spotlight=""
          className="pointer-events-none fixed z-[9000] rounded-[1rem] ring-2 ring-[color:var(--wsu-crimson)] ring-offset-2"
          style={
            spotlight
              ? {
                  top: spotlight.top,
                  left: spotlight.left,
                  width: spotlight.width,
                  height: spotlight.height,
                  boxShadow: "0 0 0 9999px rgba(33, 27, 30, 0.55)",
                  transition: reduced ? undefined : "top 0.2s ease, left 0.2s ease, width 0.2s ease, height 0.2s ease",
                }
              : { inset: 0, background: "rgba(33, 27, 30, 0.55)" }
          }
          aria-hidden
        />
      ) : null}
      <dialog
        ref={dialogRef}
        popover="manual"
        className="product-tour-popover"
        aria-labelledby={titleId}
        aria-describedby={step ? bodyId : undefined}
      >
        {step ? (
        <>
        <div className="border-b border-[color:var(--wsu-border)] px-5 py-4">
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-[color:var(--wsu-crimson)]">
            How to use · Step {stepIndex + 1} of {total}
          </p>
          <h2 id={titleId} className="mt-2 font-serif text-lg font-medium leading-snug text-[color:var(--wsu-ink)]">
            {step.title}
          </h2>
          <p id={bodyId} className="mt-2 text-sm leading-relaxed text-[color:var(--wsu-muted)]">
            {step.body}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-2 text-sm font-medium text-[color:var(--wsu-muted)] hover:text-[color:var(--wsu-crimson)]"
          >
            Skip
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onStepIndexChange(Math.max(0, stepIndex - 1))}
              disabled={isFirst}
              className="rounded-full border border-[color:var(--wsu-border)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--wsu-muted)] hover:border-[color:var(--wsu-crimson)] hover:text-[color:var(--wsu-crimson)] disabled:opacity-40"
            >
              Back
            </button>
            <button
              ref={nextRef}
              type="button"
              onClick={() => {
                if (isLast) onComplete();
                else onStepIndexChange(stepIndex + 1);
              }}
              className="rounded-full bg-[color:var(--wsu-crimson)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--wsu-crimson-dark)]"
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
        </>
        ) : null}
      </dialog>
    </>,
    document.body,
  );
}
