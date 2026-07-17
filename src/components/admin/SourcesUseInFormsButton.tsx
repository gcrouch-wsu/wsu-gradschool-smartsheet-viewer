"use client";

import Link from "next/link";
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
        body: JSON.stringify({ id: sourceId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        // Fallback: select by sheet id if source id not yet linked
        const res2 = await fetch("/api/forms/registry/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
    <div className="flex flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
      <Button type="button" variant="primary" onClick={useInForms} disabled={disabled || busy}>
        {busy ? "Opening…" : "Use in Forms"}
      </Button>
      {error ? <p className="max-w-[12rem] text-right text-[10px] text-red-700">{error}</p> : null}
      <Link href="/forms/builder" className="text-[10px] font-medium text-crimson hover:underline" onClick={(e) => e.stopPropagation()}>
        Form builder →
      </Link>
    </div>
  );
}
