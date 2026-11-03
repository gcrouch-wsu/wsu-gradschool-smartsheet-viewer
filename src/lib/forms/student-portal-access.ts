/**
 * Resolve who the student portal should load data for:
 * - admin preview cookie (view-only), or
 * - a real student session.
 */
import { NextResponse } from "next/server";
import { canManageUsers, getCurrentAdminAuthResult } from "@/lib/admin-users";
import {
  requireStudentSession,
  type StudentSessionOk,
} from "@/lib/forms/student-auth";
import { readStudentPreviewFromCookies } from "@/lib/forms/student-preview";

export type StudentPortalAccessOk = {
  ok: true;
  email: string;
  preview: boolean;
  payload?: StudentSessionOk["payload"];
};

export type StudentPortalAccessError = {
  ok: false;
  response: NextResponse;
};

export type StudentPortalAccess = StudentPortalAccessOk | StudentPortalAccessError;

export async function resolveStudentPortalAccess(): Promise<StudentPortalAccess> {
  const preview = await readStudentPreviewFromCookies();
  if (preview) {
    const admin = await getCurrentAdminAuthResult();
    if (
      admin.ok &&
      admin.principal &&
      canManageUsers(admin.principal.role) &&
      admin.principal.id === preview.adminUserId
    ) {
      return {
        ok: true,
        email: preview.studentEmail,
        preview: true,
      };
    }
  }

  const session = await requireStudentSession();
  if (!session.ok) return session;
  return {
    ok: true,
    email: session.email,
    preview: false,
    payload: session.payload,
  };
}

/** Email for page shells; null when unsigned and not previewing. */
export async function readStudentPortalEmail(): Promise<{
  email: string | null;
  preview: boolean;
}> {
  const preview = await readStudentPreviewFromCookies();
  if (preview) {
    const admin = await getCurrentAdminAuthResult();
    if (
      admin.ok &&
      admin.principal &&
      canManageUsers(admin.principal.role) &&
      admin.principal.id === preview.adminUserId
    ) {
      return { email: preview.studentEmail, preview: true };
    }
  }

  const { readStudentSessionEmail } = await import("@/lib/forms/student-auth");
  const email = await readStudentSessionEmail();
  return { email, preview: false };
}

/** True when a preview cookie is present (even if admin session is missing). */
export async function hasStudentPreviewCookie(): Promise<boolean> {
  return Boolean(await readStudentPreviewFromCookies());
}
