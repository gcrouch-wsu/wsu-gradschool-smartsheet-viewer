"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PlatformUsersManager } from "@/components/admin/PlatformUsersManager";
import { RolesMatrixManager } from "@/components/admin/RolesMatrixManager";
import type { PlatformUserSummary, RolePermissionMatrix } from "@/lib/platform-user-types";

type UsersTabId = "accounts" | "roles";

interface UsersWorkspaceProps {
  bootstrapEmail: string | null;
  bootstrapLabel: string;
  initialUsers: PlatformUserSummary[];
  /** Roles tab only for owner/admin (canManageUsers). */
  showRolesTab: boolean;
  rolesMatrix: RolePermissionMatrix | null;
  databaseEnabled: boolean;
}

function TabButton({
  id,
  label,
  active,
  onSelect,
}: {
  id: UsersTabId;
  label: string;
  active: boolean;
  onSelect: (id: UsersTabId) => void;
}) {
  return (
    <button
      id={`users-tab-${id}`}
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={`users-panel-${id}`}
      onClick={() => onSelect(id)}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-crimson bg-crimson text-white"
          : "border-line bg-white text-mist hover:border-crimson hover:text-crimson"
      }`}
    >
      {label}
    </button>
  );
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
  const initialTab: UsersTabId = canShowRoles && tabParam === "roles" ? "roles" : "accounts";
  const [activeTab, setActiveTab] = useState<UsersTabId>(initialTab);

  useEffect(() => {
    if (!canShowRoles && activeTab === "roles") {
      setActiveTab("accounts");
    }
  }, [canShowRoles, activeTab]);

  function selectTab(next: UsersTabId) {
    if (next === "roles" && !canShowRoles) return;
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

  return (
    <div className="space-y-6">
      {canShowRoles ? (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Users sections">
          <TabButton id="accounts" label="Accounts" active={activeTab === "accounts"} onSelect={selectTab} />
          <TabButton id="roles" label="Roles" active={activeTab === "roles"} onSelect={selectTab} />
        </div>
      ) : null}

      {activeTab === "accounts" ? (
        <section id="users-panel-accounts" role="tabpanel" aria-labelledby="users-tab-accounts">
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
        </section>
      ) : null}

      {activeTab === "roles" && canShowRoles && rolesMatrix ? (
        <section id="users-panel-roles" role="tabpanel" aria-labelledby="users-tab-roles" className="space-y-3">
          <p className="text-sm text-mist">
            Edit which capabilities each role grants. Owner always keeps admin.manage and admin.owner.
          </p>
          {!databaseEnabled ? (
            <div
              role="alert"
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              Role permissions require DATABASE_URL.
            </div>
          ) : (
            <RolesMatrixManager initialMatrix={rolesMatrix} />
          )}
        </section>
      ) : null}
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
