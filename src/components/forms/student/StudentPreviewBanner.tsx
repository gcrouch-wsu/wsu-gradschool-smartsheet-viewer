"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StudentPreviewBanner({ email }: { email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function stopViewing() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/users/student-preview/end", { method: "POST" });
      const body = (await response.json().catch(() => null)) as {
        message?: string;
        redirectTo?: string;
      } | null;
      if (!response.ok) {
        setError(body?.message ?? "Unable to end preview.");
        return;
      }
      router.push(body?.redirectTo ?? "/admin/users?tab=student-portal");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to end preview.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="status"
      className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>
          Viewing student portal as <span className="font-semibold">{email}</span>. View only — changes are
          blocked.
        </p>
        <button
          type="button"
          onClick={() => void stopViewing()}
          disabled={busy}
          className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-950 hover:border-amber-400 disabled:opacity-60"
        >
          {busy ? "Stopping…" : "Stop viewing"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
