"use client";

import { useEffect } from "react";

function getDocumentHeight() {
  const body = document.body;
  const root = document.documentElement;

  return Math.max(
    body?.scrollHeight ?? 0,
    body?.offsetHeight ?? 0,
    root.scrollHeight,
    root.offsetHeight,
    root.clientHeight
  );
}

export function EmbedHeightReporter() {
  useEffect(() => {
    if (window.parent === window) {
      return;
    }

    let rafId = 0;

    const postHeight = () => {
      cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        window.parent.postMessage(
          {
            source: "smartsheets-view",
            type: "embed-height",
            height: getDocumentHeight(),
          },
          "*"
        );
      });
    };

    postHeight();

    const observer = new ResizeObserver(postHeight);
    observer.observe(document.documentElement);
    if (document.body) {
      observer.observe(document.body);
    }

    window.addEventListener("load", postHeight);
    window.addEventListener("resize", postHeight);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener("load", postHeight);
      window.removeEventListener("resize", postHeight);
    };
  }, []);

  return null;
}
