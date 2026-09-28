import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminToastWrapper } from "@/components/admin/AdminToastWrapper";
import { ProductShell } from "@/components/layout/ProductShell";
import { ProductToolbar } from "@/components/layout/ProductToolbar";
import { canManageUsers, getCurrentAdminAuthResult } from "@/lib/admin-users";
import { productNav } from "@/lib/product-navigation";

export const dynamic = "force-dynamic";

function roleLabel(role: string) {
  if (role === "owner") return "Owner";
  if (role === "programs_team") return "Programs Team";
  if (role === "coordinator") return "Coordinator";
  return "Admin";
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await getCurrentAdminAuthResult();
  const principal = auth.ok ? auth.principal : null;

  if (!principal) {
    return <>{children}</>;
  }

  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "";
  const onNotifications =
    pathname === "/admin/notifications" || pathname.startsWith("/admin/notifications/");

  let canAccessAdminWorkspace = principal.role !== "coordinator";
  if (principal.source === "managed") {
    try {
      const { getPlatformUserById, capabilitiesForUserRoles } = await import("@/lib/platform-users");
      const platformUser = await getPlatformUserById(principal.id);
      if (platformUser) {
        const caps = await capabilitiesForUserRoles(platformUser.roles);
        canAccessAdminWorkspace = caps.includes("admin.manage");
      }
    } catch {
      /* keep role-based fallback */
    }
  }

  if (!canAccessAdminWorkspace && !onNotifications) {
    redirect("/forms/sheet");
  }

  const principalLabel = principal.displayName ?? principal.username;
  const showFullNav = canAccessAdminWorkspace;
  const coordinatorNav = [
    { href: "/forms/sheet", label: "Sheet", icon: "grid" as const },
    { href: "/forms/workflows", label: "Workflows", icon: "manage" as const },
    { href: "/admin/notifications", label: "Notifications", icon: "notifications" as const },
  ];

  return (
    <ProductShell
      globalNav={showFullNav ? productNav(true, { canManageUsers: canManageUsers(principal.role) }) : coordinatorNav}
      toolbar={
        <ProductToolbar
          variant="admin"
          displayName={principalLabel}
          roleLabel={roleLabel(principal.role)}
          showAdminGuide={showFullNav}
        />
      }
    >
      <AdminToastWrapper>{children}</AdminToastWrapper>
    </ProductShell>
  );
}
