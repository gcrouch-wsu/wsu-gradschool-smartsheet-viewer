"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PlatformUsersManager } from "@/components/admin/PlatformUsersManager";
import { RolesMatrixManager } from "@/components/admin/RolesMatrixManager";
import { StudentPortalPreviewPanel } from "@/components/admin/StudentPortalPreviewPanel";
import { UnderlineTabPanel, UnderlineTabs } from "@/components/ui/UnderlineTabs";
import type { PlatformUserSummary, RolePermissionMatrix } from "@/lib/platform-user-types";

type UsersTabId = "accounts" | "roles" | "student-portal";

interface UsersWorkspaceProps {
  bootstrapEmail: string | null;
  bootstrapLabel: string;
  initialUsers: PlatformUserSummary[];
  /** Roles + student preview tabs only for owner/admin (canManageUsers). */
  showRolesTab: boolean;
  rolesMatrix: RolePermissionMatrix | null;
  databaseEnabled: boolean;
}

function tabFromParam(tabParam: string | null, canShowRoles: boolean): UsersTabId {
  if (!canShowRoles) return "accounts";
  if (tabParam === "roles") return "roles";
  if (tabParam === "student-portal") return "student-portal";
  return "accounts";
}

function UsersWorkspaceInner({
  bootstrapEmail,
  bootstrapLabel,
  initialUsers,
  showRolesTab,
  rolesMatrix,
  databaseEnabled,
}: UsersWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const canShowRoles = showRolesTab && Boolean(rolesMatrix);
  const canShowStudentPortal = showRolesTab;
  const initialTab = tabFromParam(tabParam, canShowRoles || canShowStudentPortal);
  const [activeTab, setActiveTab] = useState<UsersTabId>(initialTab);

  const tabItems = useMemo(() => {
    const items: Array<{ id: UsersTabId; label: string; panelId: string }> = [
      { id: "accounts", label: "Accounts", panelId: "users-panel-accounts" },
    ];
    if (canShowRoles) {
      items.push({ id: "roles", label: "Roles", panelId: "users-panel-roles" });
    }
    if (canShowStudentPortal) {
      items.push({
        id: "student-portal",
        label: "View student portal",
        panelId: "users-panel-student-portal",
      });
    }
    return items;
  }, [canShowRoles, canShowStudentPortal]);

  useEffect(() => {
    setActiveTab(tabFromParam(tabParam, canShowRoles || canShowStudentPortal));
  }, [tabParam, canShowRoles, canShowStudentPortal]);

  useEffect(() => {
    if (!canShowRoles && activeTab === "roles") {
      setActiveTab("accounts");
    }
    if (!canShowStudentPortal && activeTab === "student-portal") {
      setActiveTab("accounts");
    }
  }, [canShowRoles, canShowStudentPortal, activeTab]);

  function selectTab(next: UsersTabId) {
    if (next === "roles" && !canShowRoles) return;
    if (next === "student-portal" && !canShowStudentPortal) return;
    setActiveTab(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "accounts") {
      params.delete("tab");
    } else {
      params.set("tab", next);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const showTablist = canShowRoles || canShowStudentPortal;

  return (
    <div className="space-y-6">
      {showTablist ? (
        <UnderlineTabs
          items={tabItems}
          value={activeTab}
          onChange={selectTab}
          ariaLabel="Users sections"
        />
      ) : null}

      <UnderlineTabPanel
        id="users-panel-accounts"
        labelledBy="tab-accounts"
        active={activeTab === "accounts"}
      >
        {!databaseEnabled ? (
          <div
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            Unified users require DATABASE_URL.
          </div>
        ) : (
          <PlatformUsersManager
            bootstrapEmail={bootstrapEmail}
            bootstrapLabel={bootstrapLabel}
            initialUsers={initialUsers}
          />
        )}
      </UnderlineTabPanel>

      <UnderlineTabPanel
        id="users-panel-roles"
        labelledBy="tab-roles"
        active={activeTab === "roles" && canShowRoles && Boolean(rolesMatrix)}
        className="space-y-3"
      >
        <p className="text-sm text-mist">
          Edit which capabilities each role grants. Owner always keeps admin.manage and admin.owner.
          Student portal is locked to the Student role.
        </p>
        {!databaseEnabled ? (
          <div
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            Role permissions require DATABASE_URL.
          </div>
        ) : rolesMatrix ? (
          <RolesMatrixManager initialMatrix={rolesMatrix} />
        ) : null}
      </UnderlineTabPanel>

      <UnderlineTabPanel
        id="users-panel-student-portal"
        labelledBy="tab-student-portal"
        active={activeTab === "student-portal" && canShowStudentPortal}
      >
        {!databaseEnabled ? (
          <div
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            Viewing a student portal requires DATABASE_URL.
          </div>
        ) : (
          <StudentPortalPreviewPanel users={initialUsers} />
        )}
      </UnderlineTabPanel>
    </div>
  );
}

/** Suspense boundary required for useSearchParams in the App Router. */
export function UsersWorkspace(props: UsersWorkspaceProps) {
  return (
    <Suspense
      fallback={
        <PlatformUsersManager
          bootstrapEmail={props.bootstrapEmail}
          bootstrapLabel={props.bootstrapLabel}
          initialUsers={props.initialUsers}
        />
      }
    >
      <UsersWorkspaceInner {...props} />
    </Suspense>
  );
}
