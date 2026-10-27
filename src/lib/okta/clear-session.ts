/**
 * Clear all app session cookies used across admin, student, contributor, and approver flows.
 */
import type { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME, getAdminSessionCookieSettings } from "@/lib/admin-auth";
import {
  CONTRIBUTOR_SESSION_COOKIE_NAME,
  getContributorSessionCookieSettings,
} from "@/lib/contributor-auth";
import {
  FORM_APPROVER_SESSION_COOKIE_NAME,
  getFormApproverSessionCookieSettings,
} from "@/lib/forms/approver-auth";
import {
  STUDENT_SESSION_COOKIE_NAME,
  getStudentSessionCookieSettings,
} from "@/lib/forms/student-users";
import { OKTA_ID_TOKEN_COOKIE } from "@/lib/okta/config";
import { getOktaIdTokenCookieSettings } from "@/lib/okta/oidc";

export function clearAllAppSessionCookies(response: NextResponse) {
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
  response.cookies.set(CONTRIBUTOR_SESSION_COOKIE_NAME, "", {
    ...getContributorSessionCookieSettings(),
    maxAge: 0,
  });
  response.cookies.set({
    ...getFormApproverSessionCookieSettings(),
    name: FORM_APPROVER_SESSION_COOKIE_NAME,
    value: "",
    maxAge: 0,
  });
  response.cookies.set({
    ...getOktaIdTokenCookieSettings(),
    name: OKTA_ID_TOKEN_COOKIE,
    value: "",
    maxAge: 0,
  });
}
