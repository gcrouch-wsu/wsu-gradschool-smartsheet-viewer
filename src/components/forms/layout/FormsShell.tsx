"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ProductShell } from "@/components/layout/ProductShell";
import { ProductToolbar } from "@/components/layout/ProductToolbar";
import { IconSearch } from "@/components/forms/icons";
import { productNav } from "@/lib/product-navigation";

interface FormsSessionInfo {
  user: { email: string; name: string; roles: string[] } | null;
  roles: string[];
  isAdmin: boolean;
  isApprover: boolean;
  isCoordinator?: boolean;
  isProgramsTeam?: boolean;
}

export function FormsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<FormsSessionInfo | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [searchQ, setSearchQ] = useState("");

  const isFormsAdminRoute =
    pathname.startsWith("/forms/manage") || pathname.startsWith("/forms/builder");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/forms/session")
      .then(async (r) => {
        const payload = (await r.json().catch(() => null)) as FormsSessionInfo | null;
        if (!cancelled) setSession(payload);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      })
      .finally(() => {
        if (!cancelled) setSessionLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (!sessionLoaded || session?.user) return;
    const next =
      pathname.startsWith("/forms") && pathname !== "/forms/approver/sign-in"
        ? `${pathname}${typeof window !== "undefined" ? window.location.search : ""}`
        : "/forms/sheet";
    router.replace(`/admin/sign-in?next=${encodeURIComponent(next)}`);
  }, [sessionLoaded, session, pathname, router]);

  const showAdminNav = Boolean(session?.isAdmin) || (!sessionLoaded && isFormsAdminRoute);
  const onWorkflows = pathname.startsWith("/forms/workflows");
  const canSearch = !onWorkflows && (session?.isAdmin || session?.isApprover);
  const accountLabel = useMemo(() => {
    if (!session?.user) return "Admin";
    if (session.isProgramsTeam) return "Programs Team";
    if (session.isAdmin) return "Admin";
    if (session.isCoordinator) return "Coordinator";
    return "Approver";
  }, [session]);

  function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQ.trim();
    if (!q) return;
    router.push(`/forms/search?q=${encodeURIComponent(q)}`);
  }

  const searchForm = canSearch ? (
    <form onSubmit={runSearch} className="relative w-full sm:w-56" data-tour="fse-shell-search">
      <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist" />
      <input
        type="search"
        value={searchQ}
        onChange={(e) => setSearchQ(e.target.value)}
        placeholder="Search…"
        aria-label="Global search"
        className="w-full rounded-full border border-line-strong bg-white py-2 pl-9 pr-3 text-[13.5px] text-ink placeholder:text-mist focus:border-crimson focus:outline-none focus:ring-1 focus:ring-crimson"
      />
    </form>
  ) : undefined;

  if (!sessionLoaded || !session?.user) {
    return (
      <ProductShell
        globalNav={productNav(showAdminNav)}
        toolbar={<ProductToolbar variant="forms" loading />}
      >
        <p className="text-sm text-[color:var(--wsu-muted)]">Redirecting to sign in…</p>
      </ProductShell>
    );
  }

  return (
    <ProductShell
      globalNav={productNav(showAdminNav, {
        canManageUsers: Boolean(session?.isAdmin) && !session?.isProgramsTeam,
      })}
      toolbar={
        <ProductToolbar
          variant="forms"
          displayName={session.user.name || session.user.email}
          roleLabel={accountLabel}
          isStaffSession={Boolean(session.isAdmin || session.isCoordinator)}
          search={searchForm}
        />
      }
    >
      {children}
    </ProductShell>
  );
}
