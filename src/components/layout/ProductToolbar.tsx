"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { NotificationBell } from "@/components/notifications/NotificationBell";

export type ProductToolbarVariant = "admin" | "forms";

interface ProductToolbarProps {
  variant: ProductToolbarVariant;
  displayName?: string;
  roleLabel?: string;
  showAdminGuide?: boolean;
  search?: ReactNode;
  /** Forms: clear admin session when true; otherwise clear approver session. */
  isStaffSession?: boolean;
  loading?: boolean;
}

const iconButtonClass =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line-strong bg-white text-ink transition hover:border-crimson disabled:opacity-60";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "—";
}

function GuideIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 4.5A2.5 2.5 0 016.5 2H20v15H6.5A2.5 2.5 0 004 19.5z" />
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20v5H6.5A2.5 2.5 0 014 19.5z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

export function ProductToolbar({
  variant,
  displayName = "",
  roleLabel = "",
  showAdminGuide = false,
  search,
  isStaffSession = false,
  loading = false,
}: ProductToolbarProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      if (variant === "admin" || isStaffSession) {
        await fetch("/api/admin/session", { method: "DELETE" });
      } else {
        await fetch("/api/forms/approver/session", { method: "DELETE" });
      }
      if (variant === "admin") {
        router.replace("/admin/sign-in");
      } else {
        router.replace("/admin/sign-in?next=/forms/sheet");
      }
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-end gap-2">
        <div
          className="h-10 w-10 animate-pulse rounded-full border border-line-strong bg-[color:var(--wsu-stone)]"
          aria-hidden
        />
        <div
          className="h-10 w-24 animate-pulse rounded-full border border-line-strong bg-[color:var(--wsu-stone)]"
          aria-hidden
        />
      </div>
    );
  }

  const identityTooltip = [displayName, roleLabel].filter(Boolean).join(" · ");

  return (
    <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2">
      {search}
      <div
        className="flex max-w-[11rem] min-w-0 items-center gap-2 rounded-full border border-line-strong bg-white py-1.5 pl-1.5 pr-3"
        title={identityTooltip}
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--crimson-soft)] font-mono text-[10px] font-semibold text-crimson"
          aria-hidden
        >
          {initialsFromName(displayName)}
        </span>
        <span className="min-w-0 truncate text-[13px] font-semibold leading-none text-ink">{displayName}</span>
        <span className="sr-only">{identityTooltip}</span>
      </div>
      <NotificationBell />
      {showAdminGuide ? (
        <Link
          href="/instructions/admin"
          className={`${iconButtonClass} text-crimson hover:bg-[var(--crimson-soft)]`}
          title="Admin guide"
          aria-label="Admin guide"
        >
          <GuideIcon />
        </Link>
      ) : null}
      <button
        type="button"
        onClick={() => void handleSignOut()}
        disabled={signingOut}
        className={iconButtonClass}
        title={signingOut ? "Signing out…" : "Log out"}
        aria-label={signingOut ? "Signing out" : "Log out"}
      >
        <LogoutIcon />
      </button>
    </div>
  );
}
