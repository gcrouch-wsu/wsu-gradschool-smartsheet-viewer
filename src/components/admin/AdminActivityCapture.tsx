"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

type UiEvent = {
  action: string;
  resourceType: string;
  resourceId?: string;
  label?: string;
  href?: string;
  path?: string;
  at: number;
};

const FLUSH_MS = 2000;
const MAX_QUEUE = 40;
const SENSITIVE_RE = /password|passwd|secret|token|credential/i;

function truncate(value: string, max = 160) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > max ? cleaned.slice(0, max) : cleaned;
}

function isInteractive(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.closest("[data-activity-ignore]")) return false;
  const tag = el.tagName;
  if (tag === "BUTTON" || tag === "A" || tag === "SUMMARY") return true;
  if (tag === "INPUT") {
    const type = (el as HTMLInputElement).type?.toLowerCase() ?? "";
    return type === "submit" || type === "button" || type === "reset";
  }
  if (el.getAttribute("role") === "button" || el.getAttribute("role") === "link") return true;
  if (el.dataset.activity) return true;
  return false;
}

function resolveTarget(start: EventTarget | null): HTMLElement | null {
  let node = start instanceof Element ? start : null;
  while (node) {
    if (isInteractive(node)) return node;
    node = node.parentElement;
  }
  return null;
}

function labelFor(el: HTMLElement): string | undefined {
  const explicit = el.getAttribute("data-activity") || el.getAttribute("aria-label");
  if (explicit) return truncate(explicit);
  if (el instanceof HTMLInputElement && el.value && !SENSITIVE_RE.test(el.name || "") && !SENSITIVE_RE.test(el.id || "")) {
    return truncate(el.value);
  }
  const text = el.innerText || el.textContent || "";
  return text ? truncate(text) : undefined;
}

/**
 * Captures admin UI clicks and page views into /api/admin/activity/ui.
 * Does not record typed field values (passwords, etc.).
 */
export function AdminActivityCapture() {
  const pathname = usePathname();
  const queueRef = useRef<UiEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPathRef = useRef<string>("");

  useEffect(() => {
    const flush = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const batch = queueRef.current.splice(0, MAX_QUEUE);
      if (!batch.length) return;
      void fetch("/api/admin/activity/ui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: batch }),
        keepalive: true,
      }).catch(() => {
        /* activity must never break the UI */
      });
    };

    const enqueue = (event: UiEvent) => {
      queueRef.current.push(event);
      if (queueRef.current.length >= MAX_QUEUE) {
        flush();
        return;
      }
      if (!timerRef.current) {
        timerRef.current = setTimeout(flush, FLUSH_MS);
      }
    };

    const onClick = (event: MouseEvent) => {
      const target = resolveTarget(event.target);
      if (!target) return;

      const href =
        target instanceof HTMLAnchorElement
          ? target.getAttribute("href") ?? undefined
          : target.closest("a")?.getAttribute("href") ?? undefined;

      enqueue({
        action: "ui.click",
        resourceType: "ui",
        resourceId: truncate(
          [
            target.tagName.toLowerCase(),
            target.id ? `#${target.id}` : "",
            target.getAttribute("name") ? `[name=${target.getAttribute("name")}]` : "",
          ].join(""),
          120,
        ),
        label: labelFor(target),
        href: href ? truncate(href, 240) : undefined,
        path: pathname || undefined,
        at: Date.now(),
      });
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("pagehide", flush);

    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [pathname]);

  useEffect(() => {
    if (!pathname || pathname === lastPathRef.current) return;
    lastPathRef.current = pathname;
    void fetch("/api/admin/activity/ui", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        events: [
          {
            action: "ui.page_view",
            resourceType: "page",
            resourceId: pathname,
            path: pathname,
            at: Date.now(),
          },
        ],
      }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
