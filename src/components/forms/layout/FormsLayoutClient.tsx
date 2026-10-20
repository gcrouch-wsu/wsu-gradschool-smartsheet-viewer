"use client";

import { usePathname } from "next/navigation";
import { FormsShell } from "@/components/forms/layout/FormsShell";

export function FormsLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isApproverSignIn = pathname === "/forms/approver/sign-in";
  const isStudentPortal = pathname === "/student" || pathname.startsWith("/student/");

  if (isApproverSignIn || isStudentPortal) {
    return <>{children}</>;
  }

  return <FormsShell>{children}</FormsShell>;
}
