/**
 * Short-lived admin preview of a student's portal (view-only).
 * Does not replace the admin session cookie.
 */
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import {
  ADMIN_PASSWORD_ENV_VAR,
  ADMIN_SESSION_SECRET_ENV_VAR,
  ADMIN_USERNAME_ENV_VAR,
} from "@/lib/admin-auth";
import { CONTRIBUTOR_SESSION_SECRET_ENV_VAR } from "@/lib/contributor-auth";

export const STUDENT_PREVIEW_COOKIE_NAME = "smartsheets_view_student_preview";
export const STUDENT_PREVIEW_TTL_SECONDS = 30 * 60;

export interface StudentPreviewPayload {
  adminUserId: string;
  studentEmail: string;
  issuedAt: number;
  expiresAt: number;
}

const encoder = new TextEncoder();

function getSigningSecret(): string | null {
  const configured = process.env[ADMIN_SESSION_SECRET_ENV_VAR]?.trim();
  if (configured) return configured;
  const contributor = process.env[CONTRIBUTOR_SESSION_SECRET_ENV_VAR]?.trim();
  if (contributor) return contributor;
  const student = process.env.STUDENT_SESSION_SECRET?.trim();
  if (student) return student;
  const username = process.env[ADMIN_USERNAME_ENV_VAR]?.trim();
  const password = process.env[ADMIN_PASSWORD_ENV_VAR] ?? "";
  if (username && password) {
    return `smartsheets-view-admin-session:${username}:${password}`;
  }
  return null;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
  return Buffer.from(padded, "base64").toString("utf8");
}

async function signValue(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Buffer.from(signature)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function getStudentPreviewCookieSettings() {
  return {
    httpOnly: true,
    maxAge: STUDENT_PREVIEW_TTL_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function createStudentPreviewToken(
  adminUserId: string,
  studentEmail: string,
  expiresAt = Date.now() + STUDENT_PREVIEW_TTL_SECONDS * 1000,
): Promise<string> {
  const secret = getSigningSecret();
  if (!secret) {
    throw new Error("Session secret is not configured.");
  }
  const payload: StudentPreviewPayload = {
    adminUserId,
    studentEmail: studentEmail.trim().toLowerCase(),
    issuedAt: Date.now(),
    expiresAt,
  };
  const encoded = encodeBase64Url(JSON.stringify(payload));
  const signature = await signValue(encoded, secret);
  return `${encoded}.${signature}`;
}

export async function readStudentPreviewToken(
  token: string | undefined | null,
): Promise<StudentPreviewPayload | null> {
  if (!token?.trim()) return null;
  const secret = getSigningSecret();
  if (!secret) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = await signValue(encoded, secret);
  if (expected !== signature) return null;
  try {
    const parsed = JSON.parse(decodeBase64Url(encoded)) as Partial<StudentPreviewPayload>;
    if (
      typeof parsed.adminUserId !== "string" ||
      typeof parsed.studentEmail !== "string" ||
      typeof parsed.issuedAt !== "number" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }
    if (parsed.expiresAt < Date.now()) return null;
    return {
      adminUserId: parsed.adminUserId,
      studentEmail: parsed.studentEmail.trim().toLowerCase(),
      issuedAt: parsed.issuedAt,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export async function readStudentPreviewFromCookies(): Promise<StudentPreviewPayload | null> {
  const cookieStore = await cookies();
  return readStudentPreviewToken(cookieStore.get(STUDENT_PREVIEW_COOKIE_NAME)?.value);
}

export function applyStudentPreviewCookie(response: NextResponse, token: string) {
  response.cookies.set({
    ...getStudentPreviewCookieSettings(),
    name: STUDENT_PREVIEW_COOKIE_NAME,
    value: token,
  });
}

export function clearStudentPreviewCookie(response: NextResponse) {
  response.cookies.set({
    ...getStudentPreviewCookieSettings(),
    name: STUDENT_PREVIEW_COOKIE_NAME,
    value: "",
    maxAge: 0,
  });
}
