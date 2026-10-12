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
    router.push(`/forms/manage?tab=${tab}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Forms workspace"
        title="Form administration"
        description="Sources live under Admin → Sources. Use Builder and Sheet for the active workspace; Webhooks for Smartsheet callbacks."
        dataTour="fm-heading"
        actions={actions}
      />

      <AdminSectionNav active={activeTab} onSelect={handleSelect} />

      {children}
    </div>
  );
}
