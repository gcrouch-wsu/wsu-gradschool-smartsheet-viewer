import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/admin-api";
import {
  AdminUserActionError,
  createAdminResetToken,
  getManagedAdminUserById,
} from "@/lib/admin-users";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApiAccess({ usersOnly: true });
  if (auth.response) return auth.response;

  const { id } = await params;
  const user = await getManagedAdminUserById(id);
  if (!user) {
    return NextResponse.json({ message: "Admin user not found." }, { status: 404 });
  }

  try {
    const token = await createAdminResetToken(user.username);
    return NextResponse.json({ token });
  } catch (error) {
    if (error instanceof AdminUserActionError) {
      return NextResponse.json({ message: error.message, errors: error.errors }, { status: error.status });
    }
    throw error;
  }
}
