import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/admin-api";
import { canManageUsers } from "@/lib/admin-users";
import {
  ASSIGNABLE_ROLES,
  type AssignablePlatformRole,
  deletePlatformUser,
  listPlatformUsers,
  savePlatformUser,
} from "@/lib/platform-users";
import { validateAdminPassword } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdminApiAccess({ usersOnly: true });
  if (auth.response) return auth.response;
  const users = await listPlatformUsers();
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const auth = await requireAdminApiAccess({ usersOnly: true });
  if (auth.response) return auth.response;
  if (!canManageUsers(auth.principal!.role)) {
    return NextResponse.json({ message: "Only owners and admins can manage users." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    displayName?: unknown;
    roles?: unknown;
    isActive?: unknown;
    password?: unknown;
  } | null;

  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const isActive = body?.isActive !== false;
  const roles = Array.isArray(body?.roles)
    ? body.roles.filter((r): r is AssignablePlatformRole => typeof r === "string" && ASSIGNABLE_ROLES.includes(r as AssignablePlatformRole))
    : [];

  if (!email) {
    return NextResponse.json({ message: "Email is required." }, { status: 400 });
  }
  if (!roles.length) {
    return NextResponse.json({ message: "At least one role is required." }, { status: 400 });
  }
  if (password) {
    const passwordError = validateAdminPassword(password);
    if (passwordError) {
      return NextResponse.json({ message: passwordError }, { status: 400 });
    }
  }

  try {
    const user = await savePlatformUser({
      email,
      displayName: displayName || null,
      roles,
      isActive,
      password: password || null,
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create user.";
    const status = message.includes("already exists") ? 409 : 400;
    return NextResponse.json({ message }, { status });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdminApiAccess({ usersOnly: true });
  if (auth.response) return auth.response;

  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ message: "User id is required." }, { status: 400 });
  }
  if (id === auth.principal!.id) {
    return NextResponse.json({ message: "You cannot delete your own account." }, { status: 400 });
  }

  await deletePlatformUser(id);
  return NextResponse.json({ ok: true });
}
