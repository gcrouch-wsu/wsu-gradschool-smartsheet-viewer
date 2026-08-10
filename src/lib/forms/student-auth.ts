/** Student portal session helpers — uses student_users + student session cookie only. */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  STUDENT_SESSION_COOKIE_NAME,
  getStudentConfigurationError,
  readStudentSessionToken,
  type StudentSessionPayload,
} from "@/lib/forms/student-users";

export interface StudentSessionOk {
  ok: true;
  email: string;
  payload: StudentSessionPayload;
}

export interface StudentSessionError {
  ok: false;
  response: NextResponse;
}

export async function requireStudentSession(): Promise<StudentSessionOk | StudentSessionError> {
  const configurationError = getStudentConfigurationError();
  if (configurationError) {
    return {
      ok: false,
      response: NextResponse.json({ error: configurationError }, { status: 503 }),
    };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(STUDENT_SESSION_COOKIE_NAME)?.value;
  const session = await readStudentSessionToken(token);
  if (!session.ok || !session.payload) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: session.message ?? "Sign in required." },
        { status: session.status ?? 401 },
      ),
    };
  }

  return { ok: true, email: session.payload.email, payload: session.payload };
}

export async function readStudentSessionEmail(): Promise<string | null> {
  const configurationError = getStudentConfigurationError();
  if (configurationError) return null;
  const cookieStore = await cookies();
  const session = await readStudentSessionToken(cookieStore.get(STUDENT_SESSION_COOKIE_NAME)?.value);
  return session.ok && session.payload ? session.payload.email : null;
}
