"use client";

import { usePathname } from "next/navigation";
import { FormsShell } from "@/components/forms/layout/FormsShell";

export function FormsLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isApproverSignIn = pathname === "/forms/approver/sign-in";
  const isStudentPortal = pathname === "/forms/my" || pathname.startsWith("/forms/my/");

  if (isApproverSignIn || isStudentPortal) {
    return <>{children}</>;
  }

  return <FormsShell>{children}</FormsShell>;
}
