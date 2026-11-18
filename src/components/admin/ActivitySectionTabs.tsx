"use client";

import { useRouter } from "next/navigation";
import { UnderlineTabs } from "@/components/ui/UnderlineTabs";

const TABS = [
  { id: "audit" as const, label: "Audit trail" },
  { id: "email" as const, label: "Email delivery" },
];

export function ActivitySectionTabs({ tab }: { tab: "audit" | "email" }) {
  const router = useRouter();

  function select(next: "audit" | "email") {
    router.push(next === "email" ? "/admin/activity?tab=email" : "/admin/activity");
  }

  return <UnderlineTabs items={TABS} value={tab} onChange={select} ariaLabel="Activity sections" equalWidth={false} />;
}
