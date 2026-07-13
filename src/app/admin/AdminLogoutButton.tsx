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
      className="flex items-center gap-1.5 rounded-full border border-transparent bg-transparent px-3 py-2 text-[13.5px] font-medium text-sub transition hover:bg-[#f4f0f1] hover:text-ink disabled:opacity-60"
    >
      <svg className="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
        <path d="M16 17l5-5-5-5M21 12H9" />
      </svg>
      {isPending ? "Signing out..." : "Log out"}
    </button>
  );
}