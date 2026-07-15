"use client";

import React, { useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type ToastVariant = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  createdAt: number;
}

interface ToastContextValue {
  addToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

let toastId = 0;
const TOAST_TTL_MS = 4000;

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      addToast: () => {},
    };
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = `toast-${++toastId}`;
    const item: ToastItem = { id, message, variant, createdAt: Date.now() };
    setToasts((prev) => [...prev, item]);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setToasts((prev) => prev.filter((t) => now - t.createdAt < TOAST_TTL_MS));
    }, 500);
    return () => clearInterval(timer);
  }, [toasts.length]);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2"
            aria-live="polite"
            aria-atomic="true"
          >
            {toasts.map((toast) => (
              <ToastItem key={toast.id} item={toast} />
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

function ToastItem({ item }: { item: ToastItem }) {
  const variantStyles: Record<ToastVariant, string> = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-rose-200 bg-rose-50 text-rose-800",
    info: "border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] text-[color:var(--wsu-ink)]",
  };
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm shadow-lg ${variantStyles[item.variant]}`}
      role="status"
    >
      {item.message}
    </div>
  );
}
