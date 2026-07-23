import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/admin-api";
import {
  AdminUserActionError,
  listAdminAccounts,
  saveManagedAdminUser,
} from "@/lib/admin-users";

function toUserInput(body: unknown) {
  const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  return {
    username: typeof record.username === "string" ? record.username : "",
    displayName: typeof record.displayName === "string" ? record.displayName : undefined,
    password: typeof record.password === "string" ? record.password : undefined,
    isActive: typeof record.isActive === "boolean" ? record.isActive : true,
  };
}

export async function GET() {
  const auth = await requireAdminApiAccess();
  if (auth.response) {
    return auth.response;
  }

  return NextResponse.json(await listAdminAccounts());
}

export async function POST(request: Request) {
  const auth = await requireAdminApiAccess();
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