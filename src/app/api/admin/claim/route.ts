import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE_NAME,
  getAdminSessionCookieSettings,
} from "@/lib/admin-auth";
import {
  ADMIN_LOGIN_TOO_MANY_ATTEMPTS_ERROR,
  claimAdminPassword,
  createAdminSessionForPrincipal,
  isAdminLoginRateLimited,
  recordAdminFailedLoginAttempt,
} from "@/lib/admin-users";
import { adminAuthRateLimitKey } from "@/lib/request-ip";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  const username =
    typeof (body as { username?: unknown })?.username === "string"
      ? (body as { username: string }).username.trim()
      : "";
  const password =
    typeof (body as { password?: unknown })?.password === "string"
      ? (body as { password: string }).password
      : "";

  if (!username || !password) {
    return NextResponse.json({ message: "Username and password are required." }, { status: 400 });
  }

  const rateLimitKey = adminAuthRateLimitKey(request.headers, username);
  if (await isAdminLoginRateLimited(rateLimitKey)) {
    return NextResponse.json({ message: ADMIN_LOGIN_TOO_MANY_ATTEMPTS_ERROR }, { status: 429 });
  }

  const authorization = await claimAdminPassword(username, password);
  if (!authorization.ok || !authorization.principal) {
    const status = authorization.status ?? 401;
    if (status === 401 || status === 404) {
      await recordAdminFailedLoginAttempt(rateLimitKey);
    }
    return NextResponse.json(
      { message: authorization.message ?? "Unable to create password." },
      { status },
    );
  }

  const response = NextResponse.json({
    ok: true,
    role: authorization.principal.role,
  });
  response.cookies.set({
    ...getAdminSessionCookieSettings(),
    name: ADMIN_SESSION_COOKIE_NAME,
    value: await createAdminSessionForPrincipal(authorization.principal),
  });
  return response;
}
