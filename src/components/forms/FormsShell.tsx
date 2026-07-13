"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AdminBreadcrumbs, type BreadcrumbItem } from "@/components/admin/AdminBreadcrumbs";
import { IconBell, IconChevronDown, IconSearch } from "@/components/forms/icons";

type FormsTab = "form" | "tracker" | "sheet" | "manage" | "search";

interface FormsSessionInfo {
  demo: boolean;
  user: { email: string; name: string; roles: string[] } | null;
  roles: string[];
  isAdmin: boolean;
  isApprover: boolean;
}

const APP_TABS: { id: FormsTab; label: string; href: string }[] = [
  { id: "form", label: "Form", href: "/forms" },
  { id: "tracker", label: "Tracker", href: "/forms/tracker" },
  { id: "sheet", label: "Grid", href: "/forms/sheet" },
  { id: "manage", label: "Admin", href: "/forms/manage" },
];

function tabFromPath(pathname: string): FormsTab {
  if (pathname.startsWith("/forms/tracker")) return "tracker";
  if (pathname.startsWith("/forms/sheet")) return "sheet";
  if (pathname.startsWith("/forms/manage")) return "manage";
  if (pathname.startsWith("/forms/search")) return "search";
  return "form";
}

function breadcrumbItems(pathname: string): BreadcrumbItem[] {
  const root: BreadcrumbItem = { href: "/", label: "Dashboard" };

  if (pathname === "/forms" || pathname === "/forms/") {
    return [root, { href: null, label: "Form" }];
  }
  if (pathname.startsWith("/forms/tracker")) {
    return [root, { href: null, label: "Tracker" }];
  }
  if (pathname.startsWith("/forms/sheet")) {
    return [root, { href: null, label: "Grid" }];
  }
  if (pathname.startsWith("/forms/manage")) {
    return [root, { href: null, label: "Admin" }];
  }
  if (pathname.startsWith("/forms/search")) {
    return [root, { href: null, label: "Search" }];
  }

  return [root];
}

function initialsFromSession(session: FormsSessionInfo | null): string {
  if (!session?.user) return "—";
  const source = session.user.name || session.user.email;
  const parts = source.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function FormsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const active = tabFromPath(pathname);
  const [session, setSession] = useState<FormsSessionInfo | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    fetch("/api/forms/session")
      .then((r) => r.json())
      .then(setSession)
      .catch(() => null);
  }, [pathname]);

  const canSearch = session?.isAdmin || session?.isApprover || session?.demo;
  const accountLabel = useMemo(() => {
    if (!session?.user) return "Admin";
    return session.isAdmin ? "Admin" : "Approver";
  }, [session]);

  function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQ.trim();
    if (!q) return;
    router.push(`/forms/search?q=${encodeURIComponent(q)}`);
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      if (session?.isAdmin) {
        await fetch("/api/admin/session", { method: "DELETE" });
        router.replace("/admin/sign-in");
      } else {
        await fetch("/api/forms/approver/session", { method: "DELETE" });
        router.replace("/forms/approver/sign-in");
      }
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-[color:var(--background)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-xl border border-[color:var(--wsu-border)] bg-white shadow-sm">
          {/* Top bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[color:var(--wsu-border)] px-5 py-4 sm:px-6">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-wsu-crimson text-xs font-medium text-white"
                aria-hidden
              >
                WSU
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">
                  Washington State University
                </p>
                <h1 className="text-base font-medium text-[color:var(--wsu-ink)]">Smartsheet Forms</h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canSearch ? (
                <form onSubmit={runSearch} className="relative">
                  <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--wsu-muted)]" />
                  <input
                    type="search"
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    placeholder="Search…"
                    aria-label="Global search"
                    className="w-44 rounded-lg border border-[color:var(--wsu-border)] bg-white py-2 pl-9 pr-3 text-sm text-[color:var(--wsu-ink)] placeholder:text-[color:var(--wsu-muted)] focus:border-wsu-crimson focus:outline-none focus:ring-1 focus:ring-wsu-crimson sm:w-52"
                  />
                </form>
              ) : null}

              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--wsu-border)] text-[color:var(--wsu-muted)] hover:bg-[color:var(--wsu-stone)]"
                aria-label="Notifications"
              >
                <IconBell />
              </button>

              {session?.user ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="flex items-center gap-2 rounded-lg border border-[color:var(--wsu-border)] py-1.5 pl-1.5 pr-2 text-sm hover:bg-[color:var(--wsu-stone)] disabled:opacity-60"
                  aria-label="Account menu — sign out"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--wsu-stone)] text-xs font-medium text-[color:var(--wsu-ink)]">
                    {initialsFromSession(session)}
                  </span>
                  <span className="font-medium text-[color:var(--wsu-ink)]">{accountLabel}</span>
                  <IconChevronDown className="h-3.5 w-3.5 text-[color:var(--wsu-muted)]" />
                </button>
              ) : (
                <Link
                  href="/forms/approver/sign-in"
                  className="rounded-lg border border-[color:var(--wsu-border)] px-3 py-2 text-sm font-medium text-[color:var(--wsu-ink)] hover:bg-[color:var(--wsu-stone)]"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>

          {/* App-level tabs */}
          <nav className="flex gap-6 border-b border-[color:var(--wsu-border)] px-5 sm:px-6" aria-label="App navigation">
            {APP_TABS.map((tab) => {
              const isActive = active === tab.id;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={[
                    "border-b-2 py-3 text-sm transition-colors",
                    isActive
                      ? "border-wsu-crimson font-medium text-[color:var(--wsu-ink)]"
                      : "border-transparent font-normal text-[color:var(--wsu-muted)] hover:text-[color:var(--wsu-ink)]",
                  ].join(" ")}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>

          {/* Page content */}
          <div className="p-5 sm:p-6">
            <AdminBreadcrumbs items={breadcrumbItems(pathname)} />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
