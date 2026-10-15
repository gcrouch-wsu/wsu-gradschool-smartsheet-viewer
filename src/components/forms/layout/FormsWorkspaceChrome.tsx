"use client";

import type { ReactNode } from "react";
import { AdminSectionNav } from "@/components/forms/admin/AdminSectionNav";
import { PageHeader } from "@/components/layout/PageHeader";

interface FormsWorkspaceChromeProps {
  children: ReactNode;
  actions?: ReactNode;
}

/**
 * Shared header for leftover Forms routes. Catalog, sheet, and builder live under Admin Sources.
 */
export function FormsWorkspaceChrome({ children, actions }: FormsWorkspaceChromeProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Forms workspace"
        title="Form administration"
        description="Open a source under Admin → Sources for sheet, builder, and workflows."
        dataTour="fm-heading"
        actions={actions}
      />
      <AdminSectionNav />
      {children}
    </div>
  );
}
