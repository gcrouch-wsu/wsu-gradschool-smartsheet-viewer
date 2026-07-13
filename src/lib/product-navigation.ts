export interface ProductNavItem {
  href: string;
  label: string;
  exact?: boolean;
}

export const formsWorkspaceNav: ProductNavItem[] = [
  { href: "/forms", label: "Form", exact: true },
  { href: "/forms/tracker", label: "Tracker" },
  { href: "/forms/sheet", label: "Grid" },
];

export function formsContextNav(isAdmin: boolean): ProductNavItem[] {
  return isAdmin
    ? [...formsWorkspaceNav, { href: "/forms/manage", label: "Manage" }]
    : formsWorkspaceNav;
}

export function productNav(isAdmin: boolean, isOwner = false): ProductNavItem[] {
  if (!isAdmin) return [];

  const items: ProductNavItem[] = [
    { href: "/admin", label: "Dashboard", exact: true },
    { href: "/admin/sources", label: "Sources" },
    { href: "/admin/views", label: "Views" },
    { href: "/admin/contributors", label: "Contributors" },
    { href: "/forms/manage", label: "Forms" },
  ];

  if (isOwner) items.push({ href: "/admin/users", label: "Admins" });
  return items;
}
