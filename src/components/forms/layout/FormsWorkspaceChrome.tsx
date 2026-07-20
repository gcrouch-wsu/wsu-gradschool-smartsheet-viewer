"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AdminSectionNav, type AdminTab } from "@/components/forms/admin/AdminSectionNav";
import { PageHeader } from "@/components/layout/PageHeader";

interface FormsWorkspaceChromeProps {
  children: ReactNode;
  /** Active manage tab when on `/forms/manage`; null on Grid / Builder. */
  activeTab?: AdminTab | null;
  onSelectTab?: (tab: AdminTab) => void;
  actions?: ReactNode;
}

/**
 * Shared Forms workspace header + section nav.
 * Content (`children`) always renders below the nav divider line.
 */
export function FormsWorkspaceChrome({
  children,
  activeTab = null,
  onSelectTab,
  actions,
}: FormsWorkspaceChromeProps) {
  const router = useRouter();

  function handleSelect(tab: AdminTab) {
    if (onSelectTab) {
      onSelectTab(tab);
      return;
    }
    const href = tab === "forms" ? "/forms/manage" : `/forms/manage?tab=${tab}`;
    router.push(href);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Forms workspace"
        title="Form administration"
        description="Sheet sources from the shared Admin Sources catalog. Use a form in grid/builder; publish for public submit."
        actions={actions}
      />

      <AdminSectionNav active={activeTab} onSelect={handleSelect} />

      {children}
    </div>
  );
}
