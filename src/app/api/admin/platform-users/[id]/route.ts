import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/admin-api";
import { validateAdminPassword } from "@/lib/admin-auth";
import {
  ASSIGNABLE_ROLES,
  type AssignablePlatformRole,
  deletePlatformUser,
  getPlatformUserById,
  savePlatformUser,
} from "@/lib/platform-users";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApiAccess({ usersOnly: true });
  if (auth.response) return auth.response;
  const { id } = await params;
  const user = await getPlatformUserById(id);
  if (!user) {
    return NextResponse.json({ message: "User not found." }, { status: 404 });
  }
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      isActive: user.isActive,
      hasPassword: Boolean(user.passwordHash && user.passwordSalt),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: user.roles,
    },
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApiAccess({ usersOnly: true });
  if (auth.response) return auth.response;
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    displayName?: unknown;
    roles?: unknown;
    isActive?: unknown;
    password?: unknown;
  } | null;

  const existing = await getPlatformUserById(id);
  if (!existing) {
    return NextResponse.json({ message: "User not found." }, { status: 404 });
  }

  const email = typeof body?.email === "string" ? body.email.trim() : existing.email;
  const displayName =
    typeof body?.displayName === "string" ? body.displayName.trim() : existing.displayName ?? "";
  const password = typeof body?.password === "string" ? body.password : "";
  const isActive = typeof body?.isActive === "boolean" ? body.isActive : existing.isActive;
  const roles = Array.isArray(body?.roles)
    ? body.roles.filter((r): r is AssignablePlatformRole =>
        typeof r === "string" && ASSIGNABLE_ROLES.includes(r as AssignablePlatformRole),
      )
    : (existing.roles.filter((r) => ASSIGNABLE_ROLES.includes(r as AssignablePlatformRole)) as AssignablePlatformRole[]);

  if (!roles.length) {
    return NextResponse.json({ message: "At least one role is required." }, { status: 400 });
  }

  // Cannot strip your own last admin.manage grant by removing admin roles.
  if (id === auth.principal!.id) {
    const keepsAdmin = roles.includes("admin");
    if (!keepsAdmin && auth.principal!.role === "admin") {
      return NextResponse.json(
        { message: "You cannot remove your own admin role." },
        { status: 400 },
      );
    }
  }

  if (password) {
    const passwordError = validateAdminPassword(password);
    if (passwordError) {
      return NextResponse.json({ message: passwordError }, { status: 400 });
    }
  }

  try {
    const user = await savePlatformUser({
      id,
      email,
      displayName: displayName || null,
      roles,
      isActive,
      password: password || null,
    });
    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update user.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApiAccess({ usersOnly: true });
  if (auth.response) return auth.response;
  const { id } = await params;
  if (id === auth.principal!.id) {
    return NextResponse.json({ message: "You cannot delete your own account." }, { status: 400 });
  }
  await deletePlatformUser(id);
  return NextResponse.json({ ok: true });
}
