"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

type CardPlacement = {
  top: number;
  left: number;
};

const SPOTLIGHT_PADDING = 8;
const CARD_GAP = 16;
const CARD_WIDTH = 360;
const TARGET_WAIT_ATTEMPTS = 24;
const TARGET_WAIT_MS = 50;

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

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

function measureTarget(selector: string): SpotlightRect | null {
  const el = document.querySelector(selector);
  if (!el || !(el instanceof HTMLElement)) return null;
  openContainingDetails(el);
  el.scrollIntoView({
    block: "nearest",
    inline: "nearest",
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return {
    top: rect.top - SPOTLIGHT_PADDING,
    left: rect.left - SPOTLIGHT_PADDING,
    width: rect.width + SPOTLIGHT_PADDING * 2,
    height: rect.height + SPOTLIGHT_PADDING * 2,
  };
}

function placeCard(spotlight: SpotlightRect, cardHeight: number): CardPlacement {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 12;

  let left = spotlight.left + spotlight.width / 2 - CARD_WIDTH / 2;
  left = Math.max(margin, Math.min(left, vw - CARD_WIDTH - margin));

  const belowTop = spotlight.top + spotlight.height + CARD_GAP;
  const aboveTop = spotlight.top - cardHeight - CARD_GAP;
  const fitsBelow = belowTop + cardHeight <= vh - margin;
  const fitsAbove = aboveTop >= margin;

  let top: number;
  if (fitsBelow) {
    top = belowTop;
  } else if (fitsAbove) {
    top = aboveTop;
  } else {
    top = Math.max(margin, Math.min(belowTop, vh - cardHeight - margin));
  }

  return { top, left };
}

async function waitForTarget(selector: string): Promise<SpotlightRect | null> {
  for (let i = 0; i < TARGET_WAIT_ATTEMPTS; i++) {
    const rect = measureTarget(selector);
    if (rect) return rect;
    await new Promise((r) => setTimeout(r, TARGET_WAIT_MS));
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
  const [cardPos, setCardPos] = useState<CardPlacement>({ top: 80, left: 24 });
  const [missing, setMissing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const resolveGen = useRef(0);

  const step = steps[stepIndex] ?? null;
  const total = steps.length;
  const isFirst = stepIndex <= 0;
  const isLast = stepIndex >= total - 1;

  useEffect(() => {
    setMounted(true);
  }, []);

  const refreshPosition = useCallback(async () => {
    if (!open || !step) {
      setSpotlight(null);
      return;
    }
    const gen = ++resolveGen.current;
    setMissing(false);
    setSpotlight(null);
    const rect = await waitForTarget(step.target);
    if (gen !== resolveGen.current) return;
    if (!rect) {
      setSpotlight(null);
      setMissing(true);
      return;
    }
    setMissing(false);
    setSpotlight(rect);
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    void refreshPosition();
  }, [open, stepIndex, refreshPosition]);

  useLayoutEffect(() => {
    if (!spotlight || !cardRef.current) return;
    const height = cardRef.current.getBoundingClientRect().height;
    setCardPos(placeCard(spotlight, height));
  }, [spotlight, stepIndex]);

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
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cardRef.current?.focus();
    return () => {
      previouslyFocused?.focus?.();
    };
  }, [open, stepIndex]);

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

  // Skip missing targets automatically (e.g. Publish on a new view).
  useEffect(() => {
    if (!open || !missing || !step) return;
    if (isLast) {
      onComplete();
      return;
    }
    const timer = setTimeout(() => onStepIndexChange(stepIndex + 1), 0);
    return () => clearTimeout(timer);
  }, [open, missing, step, isLast, stepIndex, onStepIndexChange, onComplete]);

  if (!mounted || !open || !step || total === 0) return null;

  const reduced = prefersReducedMotion();

  return createPortal(
    <div className="fixed inset-0 z-[9000]" role="presentation">
      {/* Click-catcher: transparent so the spotlight cutout stays bright */}
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-transparent"
        aria-label="Skip tour"
        onClick={onClose}
      />

      {/* Full dim while waiting for a target; spotlight uses box-shadow dim when ready */}
      {!spotlight ? (
        <div className="pointer-events-none absolute inset-0 bg-[color:var(--wsu-ink)]/55" aria-hidden />
      ) : (
        <div
          className="pointer-events-none absolute rounded-[1rem] ring-2 ring-[color:var(--wsu-crimson)] ring-offset-2"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: "0 0 0 9999px rgba(33, 27, 30, 0.55)",
            transition: reduced ? undefined : "top 0.2s ease, left 0.2s ease, width 0.2s ease, height 0.2s ease",
          }}
          aria-hidden
        />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        className={cx(
          "absolute w-[min(100vw-24px,360px)] outline-none",
          "rounded-[1.25rem] border border-[color:var(--wsu-border)] bg-white",
          "shadow-[0_20px_50px_rgba(35,31,32,0.22)]",
        )}
        style={{
          top: cardPos.top,
          left: cardPos.left,
          transition: reduced ? undefined : "top 0.2s ease, left 0.2s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
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
              type="button"
              onClick={() => {
                if (isLast) {
                  onComplete();
                } else {
                  onStepIndexChange(stepIndex + 1);
                }
              }}
              className="rounded-full bg-[color:var(--wsu-crimson)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--wsu-crimson-dark)]"
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
