"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type FormsTab = "form" | "tracker" | "sheet" | "manage" | "search";

interface FormsSessionInfo {
  demo: boolean;
  user: { email: string; name: string; roles: string[] } | null;
  roles: string[];
  isAdmin: boolean;
  isApprover: boolean;
}

function tabFromPath(pathname: string): FormsTab {
  if (pathname.startsWith("/forms/tracker")) return "tracker";
  if (pathname.startsWith("/forms/sheet")) return "sheet";
  if (pathname.startsWith("/forms/manage")) return "manage";
  if (pathname.startsWith("/forms/search")) return "search";
  return "form";
}

function navClass(active: boolean) {
  return active
    ? "view-control-active"
    : "rounded-full border border-[color:var(--wsu-border)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--wsu-muted)] hover:border-[color:var(--wsu-crimson)] hover:text-[color:var(--wsu-crimson)]";
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

  const canSearch =
    session?.isAdmin ||
    session?.isApprover ||
    session?.demo;

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
    <div className="forms-module min-h-screen bg-[linear-gradient(180deg,rgba(166,15,45,0.06),rgba(248,246,243,0.8))] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] px-6 py-6 shadow-[0_24px_64px_rgba(35,31,32,0.07)] sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--wsu-crimson)]">
                Washington State University
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[color:var(--wsu-ink)]">
                Smartsheet Forms
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-[color:var(--wsu-muted)]">
                Submit requests, track approvals, and manage workflow-connected Smartsheet forms.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {session?.demo ? (
                <span className="tag">Demo mode</span>
              ) : session?.user ? (
                <>
                  <div className="rounded-full border border-[color:var(--wsu-border)] bg-white px-4 py-2 text-right text-sm text-[color:var(--wsu-muted)]">
                    <p className="font-medium text-[color:var(--wsu-ink)]">
                      {session.user.name || session.user.email}
                    </p>
                    <p>{session.isAdmin ? "Admin" : "Approver"}</p>
                  </div>
                  {session.isAdmin ? (
                    <Link
                      href="/admin"
                      className="rounded-full border border-[color:var(--wsu-border)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--wsu-muted)] hover:border-[color:var(--wsu-crimson)] hover:text-[color:var(--wsu-crimson)]"
                    >
                      View builder
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="rounded-full border border-[color:var(--wsu-border)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--wsu-muted)] hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed"
                  >
                    {signingOut ? "Signing out…" : "Sign out"}
                  </button>
                </>
              ) : (
                <Link
                  href="/forms/approver/sign-in"
                  className="rounded-full border border-[color:var(--wsu-crimson)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--wsu-crimson)] hover:bg-[color:var(--wsu-crimson)]/8"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <nav className="flex flex-wrap gap-2">
              <Link href="/forms" className={navClass(active === "form")}>
                Form
              </Link>
              <Link href="/forms/tracker" className={navClass(active === "tracker")}>
                Tracker
              </Link>
              <Link href="/forms/sheet" className={navClass(active === "sheet")}>
                Grid
              </Link>
              <Link href="/forms/manage" className={navClass(active === "manage")}>
                Admin
              </Link>
            </nav>
            {canSearch ? (
              <form className="ml-auto flex min-w-[12rem] flex-1 items-center sm:max-w-xs" onSubmit={runSearch}>
                <input
                  className="view-input w-full rounded-full px-4 py-2 text-sm"
                  type="search"
                  placeholder="Search…"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  aria-label="Search submissions"
                />
              </form>
            ) : null}
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
