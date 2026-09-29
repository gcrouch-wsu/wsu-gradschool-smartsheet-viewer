import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME, getAdminSessionCookieSettings } from "@/lib/admin-auth";
import {
  STUDENT_SESSION_COOKIE_NAME,
  getStudentSessionCookieSettings,
} from "@/lib/forms/student-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    ...getAdminSessionCookieSettings(),
    name: ADMIN_SESSION_COOKIE_NAME,
    value: "",
    maxAge: 0,
  });
  response.cookies.set(STUDENT_SESSION_COOKIE_NAME, "", {
    ...getStudentSessionCookieSettings(),
    maxAge: 0,
  });
  return response;
}
