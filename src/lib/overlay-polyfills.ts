let pending: Promise<void> | null = null;

/** Load popover and anchor-positioning polyfills only when native support is missing. */
export function ensureOverlayPolyfills(): Promise<void> {
  if (pending) return pending;
  pending = (async () => {
    if (typeof window === "undefined") return;
    const jobs: Promise<unknown>[] = [];
    if (!Object.hasOwn(HTMLElement.prototype, "popover")) {
      jobs.push(import("@oddbird/popover-polyfill"));
    }
    if (!CSS.supports("anchor-name: --a")) {
      jobs.push(import("@oddbird/css-anchor-positioning/fn").then((mod) => mod.default()));
    }
    await Promise.all(jobs);
  })();
  return pending;
}
