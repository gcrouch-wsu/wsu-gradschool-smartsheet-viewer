export type ProductNavIcon =
  | "dashboard"
  | "sources"
  | "views"
  | "contributors"
  | "students"
  | "forms"
  | "admins"
  | "form"
  | "tracker"
  | "grid"
  | "manage"
  | "builder"
  | "activity";

export interface ProductNavItem {
  href: string;
  label: string;
  exact?: boolean;
  icon?: ProductNavIcon;
}

export function productNav(isAdmin: boolean, options?: { canManageUsers?: boolean }): ProductNavItem[] {
  if (!isAdmin) return [];

  const items: ProductNavItem[] = [
    { href: "/admin", label: "Dashboard", exact: true, icon: "dashboard" },
    { href: "/admin/sources", label: "Sources", icon: "sources" },
    { href: "/admin/views", label: "Views", icon: "views" },
    { href: "/admin/contributors", label: "Contributors", icon: "contributors" },
    { href: "/admin/students", label: "Students", icon: "students" },
    { href: "/admin/activity", label: "Activity", icon: "activity" },
    { href: "/forms/manage", label: "Forms", icon: "forms" },
    { href: "/admin/reroutes", label: "Reroutes", icon: "tracker" },
  ];

  if (options?.canManageUsers !== false) {
    items.push({ href: "/admin/users", label: "Users", icon: "admins" });
  }

  return items;
}
