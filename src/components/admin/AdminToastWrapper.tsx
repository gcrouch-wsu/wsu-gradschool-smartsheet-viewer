"use client";

import { ToastProvider } from "@/components/ui/Toast";

export function AdminToastWrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
