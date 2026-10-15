"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/layout/Breadcrumbs";

function sourceSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/admin\/sources\/([^/]+)/);
  if (!match) return null;
  const id = match[1];
  if (!id || id === "new") return null;
  return id;
}

function itemsForPath(pathname: string, sourceSlug: string | null): BreadcrumbItem[] {
  const dashboard: BreadcrumbItem = { href: "/admin", label: "Dashboard" };

  if (pathname.startsWith("/student")) {
    return [{ href: null, label: pathname === "/student" ? "My submissions" : "Submission" }];
  }

  if (pathname.startsWith("/admin/sources")) {
    const sourcesCrumb: BreadcrumbItem = { href: "/admin/sources", label: "Sources" };
    if (pathname === "/admin/sources" || pathname === "/admin/sources/") {
      return [dashboard, { href: null, label: "Sources" }];
    }
    if (pathname.endsWith("/new") || pathname.includes("/sources/new")) {
      return [dashboard, sourcesCrumb, { href: null, label: "New source" }];
    }
    const id = sourceSlugFromPath(pathname) ?? "Source";
    const label = sourceSlug || id;
    const sourceCrumb: BreadcrumbItem = {
      href: `/admin/sources/${encodeURIComponent(id)}`,
      label,
    };
    if (pathname.includes("/sheet")) {
      return [dashboard, sourcesCrumb, sourceCrumb, { href: null, label: "Sheet" }];
    }
    if (pathname.includes("/builder")) {
      return [dashboard, sourcesCrumb, sourceCrumb, { href: null, label: "Builder" }];
    }
    if (pathname.includes("/workflows")) {
      return [dashboard, sourcesCrumb, sourceCrumb, { href: null, label: "Workflows" }];
    }
    return [dashboard, sourcesCrumb, { href: null, label }];
  }
  if (pathname.startsWith("/admin/views")) {
    return [dashboard, { href: null, label: pathname === "/admin/views" ? "Views" : "View" }];
  }
  if (pathname.startsWith("/admin/contributors")) return [dashboard, { href: null, label: "Contributors" }];
  if (pathname.startsWith("/admin/students")) return [dashboard, { href: null, label: "Students" }];
  if (pathname.startsWith("/admin/users")) return [dashboard, { href: null, label: "Users" }];
  if (pathname.startsWith("/admin/activity")) return [dashboard, { href: null, label: "Activity" }];
  if (pathname.startsWith("/admin/notifications")) return [dashboard, { href: null, label: "Notifications" }];
  if (pathname.startsWith("/admin/reroutes")) return [dashboard, { href: null, label: "Reroutes" }];

  return [{ href: null, label: "Dashboard" }];
}

export function ProductBreadcrumbs() {
  const pathname = usePathname();
  const pathSourceId = sourceSlugFromPath(pathname);
  const [sourceSlug, setSourceSlug] = useState<string | null>(pathSourceId);

  useEffect(() => {
    if (!pathSourceId) {
      setSourceSlug(null);
      return;
    }
    let cancelled = false;
    setSourceSlug(pathSourceId);
    fetch(`/api/admin/sources/${encodeURIComponent(pathSourceId)}`, { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) return null;
        return r.json() as Promise<{
          source?: { id?: string; label?: string; formSlug?: string };
        }>;
      })
      .then((d) => {
        if (cancelled || !d?.source) return;
        const slug = (d.source.formSlug || d.source.id || pathSourceId).trim();
        setSourceSlug(slug || pathSourceId);
      })
      .catch(() => {
        if (!cancelled) setSourceSlug(pathSourceId);
      });
    return () => {
      cancelled = true;
    };
  }, [pathSourceId]);

  return <Breadcrumbs items={itemsForPath(pathname, sourceSlug)} />;
}
