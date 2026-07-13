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
  | "manage";

export interface ProductNavItem {
  href: string;
  label: string;
  exact?: boolean;
  icon?: ProductNavIcon;
}

export const formsWorkspaceNav: ProductNavItem[] = [
  { href: "/forms", label: "Form", exact: true, icon: "form" },
  { href: "/forms/tracker", label: "Tracker", icon: "tracker" },
  { href: "/forms/sheet", label: "Grid", icon: "grid" },
];

export function formsContextNav(isAdmin: boolean): ProductNavItem[] {
  return isAdmin
    ? [...formsWorkspaceNav, { href: "/forms/manage", label: "Manage", icon: "manage" }]
    : formsWorkspaceNav;
}

export function productNav(isAdmin: boolean, isOwner = false): ProductNavItem[] {
  if (!isAdmin) return [];

  const items: ProductNavItem[] = [
    { href: "/admin", label: "Dashboard", exact: true, icon: "dashboard" },
    { href: "/admin/sources", label: "Sources", icon: "sources" },
    { href: "/admin/views", label: "Views", icon: "views" },
    { href: "/admin/contributors", label: "Contributors", icon: "contributors" },
    { href: "/forms/manage", label: "Forms", icon: "forms" },
  ];

  if (isOwner) items.push({ href: "/admin/users", label: "Admins", icon: "admins" });
  return items;
}
