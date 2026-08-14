"use client";

import { useCallback, useEffect, useState } from "react";

export function useProductTour(storageKey: string, options?: { enabled?: boolean; autoStartDelayMs?: number }) {
  const enabled = options?.enabled !== false;
  const autoStartDelayMs = options?.autoStartDelayMs ?? 400;
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const markSeen = useCallback(() => {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // ignore storage failures (private mode, etc.)
    }
  }, [storageKey]);

  const closeTour = useCallback(() => {
    markSeen();
    setOpen(false);
  }, [markSeen]);

  const completeTour = useCallback(() => {
    markSeen();
    setOpen(false);
  }, [markSeen]);

  const startTour = useCallback(() => {
    setStepIndex(0);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    try {
      if (window.localStorage.getItem(storageKey)) return;
    } catch {
      return;
    }
    const timer = window.setTimeout(() => startTour(), autoStartDelayMs);
    return () => window.clearTimeout(timer);
  }, [enabled, storageKey, autoStartDelayMs, startTour]);

  return {
    open,
    stepIndex,
    setStepIndex,
    startTour,
    closeTour,
    completeTour,
  };
}
