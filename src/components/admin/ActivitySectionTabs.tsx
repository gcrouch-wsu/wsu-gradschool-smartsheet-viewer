"use client";

import { useRouter } from "next/navigation";
import { UnderlineTabs } from "@/components/ui/UnderlineTabs";

const TABS = [
  { id: "audit" as const, label: "Audit trail", dataTour: "aa-tab-audit" },
  { id: "email" as const, label: "Email delivery", dataTour: "aa-tab-email" },
  { id: "runs" as const, label: "Failed runs", dataTour: "aa-tab-runs" },
];

export function ActivitySectionTabs({ tab }: { tab: "audit" | "email" | "runs" }) {
  const router = useRouter();

  function select(next: "audit" | "email" | "runs") {
    if (next === "audit") {
      router.push("/admin/activity");
      return;
    }
    router.push(`/admin/activity?tab=${next}`);
  }

  return (
    <div data-tour="aa-sections">
      <UnderlineTabs items={TABS} value={tab} onChange={select} ariaLabel="Activity sections" equalWidth={false} />
    </div>
  );
}
