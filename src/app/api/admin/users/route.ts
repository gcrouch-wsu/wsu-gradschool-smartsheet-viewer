import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/admin-api";
import {
  AdminUserActionError,
  isManagedAdminRole,
  listAdminAccounts,
  saveManagedAdminUser,
  type ManagedAdminUserInput,
} from "@/lib/admin-users";

function toUserInput(body: unknown): ManagedAdminUserInput {
  const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  return {
    username: typeof record.username === "string" ? record.username : "",
    displayName: typeof record.displayName === "string" ? record.displayName : undefined,
    password: typeof record.password === "string" ? record.password : undefined,
    isActive: typeof record.isActive === "boolean" ? record.isActive : true,
    role: typeof record.role === "string" && isManagedAdminRole(record.role) ? record.role : undefined,
  };
}

export async function GET() {
  const auth = await requireAdminApiAccess({ usersOnly: true });
  if (auth.response) {
    return auth.response;
  }

  return NextResponse.json(await listAdminAccounts());
}

export async function POST(request: Request) {
  const auth = await requireAdminApiAccess({ usersOnly: true });
  if (auth.response) {
    return auth.response;
  }

  const body = await request.json().catch(() => null);

  try {
    const user = await saveManagedAdminUser(toUserInput(body), { currentUserId: auth.principal?.id });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminUserActionError) {
      return NextResponse.json(
        { message: error.message, errors: error.errors },
        { status: error.status },
      );
    }

    throw error;
  }
}