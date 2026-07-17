"use client";

import { usePathname } from "next/navigation";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/layout/Breadcrumbs";

function itemsForPath(pathname: string): BreadcrumbItem[] {
  const dashboard: BreadcrumbItem = { href: "/admin", label: "Dashboard" };

  if (pathname.startsWith("/forms")) {
    const forms: BreadcrumbItem = { href: "/forms/manage", label: "Forms" };
    if (pathname.startsWith("/forms/tracker")) return [dashboard, forms, { href: null, label: "Tracker" }];
    if (pathname.startsWith("/forms/sheet")) return [dashboard, forms, { href: null, label: "Grid" }];
    if (pathname.startsWith("/forms/manage")) return [dashboard, forms, { href: null, label: "Manage" }];
    if (pathname.startsWith("/forms/builder")) return [dashboard, forms, { href: null, label: "Builder" }];
    if (pathname.startsWith("/forms/search")) return [dashboard, forms, { href: null, label: "Search" }];
    return [dashboard, forms];
  }

  if (pathname.startsWith("/admin/sources")) {
    return [dashboard, { href: null, label: pathname === "/admin/sources" ? "Sources" : "Source" }];
  }
  if (pathname.startsWith("/admin/views")) {
    return [dashboard, { href: null, label: pathname === "/admin/views" ? "Views" : "View" }];
  }
  if (pathname.startsWith("/admin/contributors")) return [dashboard, { href: null, label: "Contributors" }];
  if (pathname.startsWith("/admin/users")) return [dashboard, { href: null, label: "Admins" }];

  return [{ href: null, label: "Dashboard" }];
}

export function ProductBreadcrumbs() {
  return <Breadcrumbs items={itemsForPath(usePathname())} />;
}
