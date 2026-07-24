"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminLogoutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleLogout() {
    setIsPending(true);

    try {
      await fetch("/api/admin/session", {
        method: "DELETE",
      });
    } finally {
      router.replace("/admin/sign-in");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-line-strong bg-white px-3 py-2 text-[13.5px] font-medium text-ink transition hover:border-mist hover:bg-[#faf7f8] disabled:opacity-60 xl:flex-none xl:border-transparent xl:bg-transparent xl:px-3 xl:text-sub xl:hover:bg-[#f4f0f1] xl:hover:text-ink"
    >
      <svg className="h-[15px] w-[15px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
        <path d="M16 17l5-5-5-5M21 12H9" />
      </svg>
      {isPending ? "Signing out…" : "Log out"}
    </button>
  );
}