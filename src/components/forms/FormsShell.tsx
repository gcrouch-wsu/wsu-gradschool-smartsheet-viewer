"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ProductShell } from "@/components/layout/ProductShell";
import { IconBell, IconChevronDown, IconSearch } from "@/components/forms/icons";
import { formsContextNav, productNav } from "@/lib/product-navigation";

interface FormsSessionInfo {
  demo: boolean;
  user: { email: string; name: string; roles: string[] } | null;
  roles: string[];
  isAdmin: boolean;
  isApprover: boolean;
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
    <ProductShell
      globalNav={productNav(Boolean(session?.isAdmin))}
      contextNav={formsContextNav(Boolean(session?.isAdmin))}
      title="Smartsheet Workspace"
      description="Submit forms, track approvals, and manage Smartsheet workflows."
      actions={
        <>
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
              className="flex items-center gap-2 rounded-full border border-[color:var(--wsu-border)] bg-white py-1.5 pl-1.5 pr-2 text-sm hover:bg-[color:var(--wsu-stone)] disabled:opacity-60"
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
              className="rounded-full border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm font-medium text-[color:var(--wsu-ink)] hover:bg-[color:var(--wsu-stone)]"
            >
              Sign in
            </Link>
          )}
        </>
      }
    >
      {children}
    </ProductShell>
  );
}
