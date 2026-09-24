import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/admin-api";
import { createPlatformResetToken, getPlatformUserById } from "@/lib/platform-users";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApiAccess({ usersOnly: true });
  if (auth.response) return auth.response;
  const { id } = await params;
  const user = await getPlatformUserById(id);
  if (!user) {
    return NextResponse.json({ message: "User not found." }, { status: 404 });
  }
  const token = await createPlatformResetToken(id);
  return NextResponse.json({ token });
}
