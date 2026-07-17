"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ProductShell } from "@/components/layout/ProductShell";
import { IconChevronDown, IconSearch } from "@/components/forms/icons";
import { productNav } from "@/lib/product-navigation";

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
      title="Smartsheet Workspace"
      description="Submit forms, track approvals, and manage Smartsheet workflows."
      identity={
        session?.user ? (
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex items-center gap-2.5 rounded-full border border-line-strong bg-white py-2 pl-2 pr-4 text-left transition hover:border-mist disabled:opacity-60"
            aria-label="Account menu — sign out"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--crimson-soft)] font-mono text-xs font-semibold text-crimson">
              {initialsFromSession(session)}
            </span>
            <span>
              <span className="block text-[13.5px] font-semibold leading-none text-ink">{session.user.name || session.user.email}</span>
              <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-mist">{accountLabel}</span>
            </span>
            <IconChevronDown className="ml-1 h-3.5 w-3.5 text-mist" />
          </button>
        ) : (
          <Link
            href="/forms/approver/sign-in"
            className="rounded-full border border-line-strong bg-white px-4 py-2 text-[13.5px] font-medium text-ink transition hover:border-mist hover:bg-[#faf7f8]"
          >
            Sign in
          </Link>
        )
      }
      actions={
        canSearch ? (
          <form onSubmit={runSearch} className="relative">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist" />
            <input
              type="search"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search…"
              aria-label="Global search"
              className="w-44 rounded-full border border-line-strong bg-white py-2 pl-9 pr-3 text-[13.5px] text-ink placeholder:text-mist focus:border-crimson focus:outline-none focus:ring-1 focus:ring-crimson sm:w-56"
            />
          </form>
        ) : undefined
      }
    >
      {children}
    </ProductShell>
  );
}
