"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type MouseEvent,
  type MutableRefObject,
  type ReactNode,
  type SyntheticEvent,
} from "react";

const DrawerCloseContext = createContext<() => void>(() => {});

/** Starts the drawer's slide-out. The parent `onClose` runs after the panel leaves the screen. */
export function useEdgeDrawerClose() {
  return useContext(DrawerCloseContext);
}

type Phase = "closed" | "opening" | "open" | "closing";

/**
 * Right-edge modal drawer. A horizontal scroll-snap container slides the sheet
 * in and out so a swipe, Escape, or the close button share one animation.
 */
export function EdgeDrawer({
  open,
  onClose,
  labelledBy,
  label,
  lightDismiss = false,
  width = "min(36rem, 100dvw - 24px)",
  closeRef,
  id,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  label?: string;
  lightDismiss?: boolean;
  width?: string;
  closeRef?: MutableRefObject<(() => void) | null>;
  id?: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const phase = useRef<Phase>("closed");
  const titleId = useId();
  onCloseRef.current = onClose;

  const finishClose = useCallback(() => {
    if (phase.current === "closed") return;
    phase.current = "closed";
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    onCloseRef.current();
  }, []);

  const requestClose = useCallback(() => {
    const dialog = dialogRef.current;
    const scroller = scrollerRef.current;
    if (!dialog?.open || !scroller) {
      onCloseRef.current();
      return;
    }
    if (phase.current === "closing") return;
    phase.current = "closing";
    const done = () => {
      if (phase.current !== "closing") return;
      finishClose();
    };
    scroller.addEventListener("scrollend", done, { once: true });
    scroller.scrollTo({ left: 0, behavior: "auto" });
    if (scroller.scrollLeft <= 1) done();
  }, [finishClose]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const scroller = scrollerRef.current;
    if (!open || !dialog || !scroller) return;
    let cancelled = false;
    phase.current = "opening";

    async function run() {
      if (!dialog || !scroller) return;
      if (!dialog.open) dialog.showModal();
      if (!CSS.supports("scroll-initial-target", "nearest")) {
        scroller.scrollTo({ left: 0, behavior: "instant" });
        await new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        });
      }
      if (cancelled) return;
      let left = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      if (left <= 1) {
        await new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        });
        left = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      }
      if (cancelled) return;
      scroller.scrollTo({ left, behavior: "auto" });
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!closeRef) return;
    closeRef.current = requestClose;
    return () => {
      closeRef.current = null;
    };
  }, [closeRef, requestClose]);

  useLayoutEffect(() => {
    if (open) return;
    if (dialogRef.current?.open) requestClose();
  }, [open, requestClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const scroller = scrollerRef.current;
    const sheet = sheetRef.current;
    if (!dialog || !scroller || !sheet) return;

    const cleanups: Array<() => void> = [];
    if (!CSS.supports("animation-timeline: scroll()")) {
      const onScroll = () => {
        const widthPx = sheet.offsetWidth || 1;
        dialog.style.setProperty("--drawer-backdrop", String(scroller.scrollLeft / widthPx));
      };
      scroller.addEventListener("scroll", onScroll, { passive: true });
      cleanups.push(() => scroller.removeEventListener("scroll", onScroll));
    }

    const threshold = 1 / Math.max(window.innerWidth, 1);
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries.at(-1);
        if (!entry) return;
        if (entry.intersectionRatio >= 0.99) {
          phase.current = "open";
          return;
        }
        if (entry.intersectionRatio < threshold && phase.current === "open") {
          finishClose();
        }
      },
      { root: dialog, threshold: [threshold, 0.99, 1] },
    );
    observer.observe(sheet);
    cleanups.push(() => observer.disconnect());
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [finishClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    if (event.nativeEvent.cancelable) event.preventDefault();
    requestClose();
  }

  function handleClick(event: MouseEvent<HTMLDialogElement>) {
    if (!lightDismiss) return;
    if (sheetRef.current?.contains(event.target as Node)) return;
    requestClose();
  }

  return (
    <DrawerCloseContext.Provider value={requestClose}>
      <dialog
        ref={dialogRef}
        id={id}
        className="edge-drawer"
        style={{ ["--drawer-width" as string]: width }}
        aria-labelledby={labelledBy ?? titleId}
        aria-label={labelledBy ? undefined : label}
        onCancel={handleCancel}
        onClick={handleClick}
      >
        <div ref={scrollerRef} className="edge-drawer-scroller">
          <div ref={sheetRef} className="edge-drawer-sheet">
            {labelledBy ? null : (
              <h2 id={titleId} className="sr-only">
                {label ?? "Drawer"}
              </h2>
            )}
            {children}
          </div>
        </div>
      </dialog>
    </DrawerCloseContext.Provider>
  );
}
