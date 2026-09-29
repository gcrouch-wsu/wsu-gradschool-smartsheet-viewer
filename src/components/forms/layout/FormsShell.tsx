"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ProductShell } from "@/components/layout/ProductShell";
import { ProductToolbar } from "@/components/layout/ProductToolbar";
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
  const accountLabel = useMemo(() => {
    if (!session?.user) return "Admin";
    if (session.isProgramsTeam) return "Programs Team";
    if (session.isAdmin) return "Admin";
    if (session.isCoordinator) return "Coordinator";
    return "Approver";
  }, [session]);

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
        />
      }
    >
      {children}
    </ProductShell>
  );
}
