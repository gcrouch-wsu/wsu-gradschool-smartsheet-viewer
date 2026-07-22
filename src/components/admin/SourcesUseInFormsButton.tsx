"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/admin/WorkspacePrimitives";

interface SourcesUseInFormsButtonProps {
  sourceId: string;
  sheetId: number;
  disabled?: boolean;
}

export function SourcesUseInFormsButton({ sourceId, sheetId, disabled }: SourcesUseInFormsButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function useInForms(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/forms/registry/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: sourceId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        const res2 = await fetch("/api/forms/registry/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id: String(sheetId) }),
        });
        if (!res2.ok) {
          throw new Error(data.error || data.message || "Could not activate this source in Forms.");
        }
      }
      router.push("/forms/manage");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not activate Forms.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative z-10 flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="primary"
        onClick={useInForms}
        disabled={disabled || busy}
        className="cursor-pointer"
        aria-label="Use this source in Forms"
      >
        {busy ? "Opening…" : "Use in Forms"}
      </Button>
      {error ? <p className="max-w-[14rem] text-right text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
