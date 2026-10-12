"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormsWorkspaceChrome } from "@/components/forms/layout/FormsWorkspaceChrome";
import { WorkflowsWorkspace } from "@/components/workflows/WorkflowsWorkspace";

export default function WorkflowsPage() {
  return (
    <Suspense
      fallback={
        <FormsWorkspaceChrome>
          <p className="text-sm text-[color:var(--wsu-muted)]">Loading workflows…</p>
        </FormsWorkspaceChrome>
      }
    >
      <WorkflowsPageContent />
    </Suspense>
  );
}

function WorkflowsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sheetId = searchParams.get("sheetId")?.trim() ?? "";

  useEffect(() => {
    if (!sheetId) {
      router.replace("/forms/sheet");
    }
  }, [sheetId, router]);

  if (!sheetId) {
    return (
      <FormsWorkspaceChrome>
        <p className="text-sm text-[color:var(--wsu-muted)]">Open workflows from a sheet.</p>
      </FormsWorkspaceChrome>
    );
  }

  return <WorkflowsWorkspace sheetId={sheetId} />;
}
