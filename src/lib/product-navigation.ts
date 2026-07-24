export type ProductNavIcon =
  | "dashboard"
  | "sources"
  | "views"
  | "contributors"
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

export function productNav(isAdmin: boolean): ProductNavItem[] {
  if (!isAdmin) return [];

  return [
    { href: "/admin", label: "Dashboard", exact: true, icon: "dashboard" },
    { href: "/admin/sources", label: "Sources", icon: "sources" },
    { href: "/admin/views", label: "Views", icon: "views" },
    { href: "/admin/contributors", label: "Contributors", icon: "contributors" },
    { href: "/admin/activity", label: "Activity", icon: "activity" },
    { href: "/forms/manage", label: "Forms", icon: "forms" },
    { href: "/admin/users", label: "Admins", icon: "admins" },
  ];
}
