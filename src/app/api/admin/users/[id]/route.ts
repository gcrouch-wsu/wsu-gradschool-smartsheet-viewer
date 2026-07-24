import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/admin-api";
import {
  AdminUserActionError,
  deleteManagedAdminUser,
  getManagedAdminUserById,
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiAccess();
  if (auth.response) {
    return auth.response;
  }

  const { id } = await params;
  const user = await getManagedAdminUserById(id);
  if (!user) {
    return NextResponse.json({ message: `Admin user "${id}" was not found.` }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiAccess();
  if (auth.response) {
    return auth.response;
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);

  try {
    const user = await saveManagedAdminUser(toUserInput(body), { id, currentUserId: auth.principal?.id });
    return NextResponse.json({ user });
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiAccess();
  if (auth.response) {
    return auth.response;
  }

  const { id } = await params;

  try {
    await deleteManagedAdminUser(id);
    return NextResponse.json({ ok: true });
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