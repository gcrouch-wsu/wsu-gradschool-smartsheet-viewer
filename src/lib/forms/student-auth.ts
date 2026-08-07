/** Student portal auth helpers — reuses contributor session cookie. */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  CONTRIBUTOR_SESSION_COOKIE_NAME,
  getContributorConfigurationError,
  readContributorSessionToken,
  type ContributorSessionPayload,
} from "@/lib/contributor-auth";

export interface StudentSessionOk {
  ok: true;
  email: string;
  payload: ContributorSessionPayload;
}

export interface StudentSessionError {
  ok: false;
  response: NextResponse;
}

export async function requireStudentSession(): Promise<StudentSessionOk | StudentSessionError> {
  const configurationError = getContributorConfigurationError();
  if (configurationError) {
    return {
      ok: false,
      response: NextResponse.json({ error: configurationError }, { status: 503 }),
    };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(CONTRIBUTOR_SESSION_COOKIE_NAME)?.value;
  const session = await readContributorSessionToken(token);
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
  const configurationError = getContributorConfigurationError();
  if (configurationError) return null;
  const cookieStore = await cookies();
  const session = await readContributorSessionToken(cookieStore.get(CONTRIBUTOR_SESSION_COOKIE_NAME)?.value);
  return session.ok && session.payload ? session.payload.email : null;
}
