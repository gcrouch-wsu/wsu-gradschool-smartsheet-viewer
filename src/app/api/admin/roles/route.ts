import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/admin-api";
import type { PrincipalCapability } from "@/lib/identity/principal";
import {
  ALL_CAPABILITIES,
  getRolePermissionMatrix,
  saveRolePermissionMatrix,
} from "@/lib/platform-users";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdminApiAccess({ usersOnly: true });
  if (auth.response) return auth.response;
  const matrix = await getRolePermissionMatrix();
  return NextResponse.json(matrix);
}

export async function PUT(request: Request) {
  const auth = await requireAdminApiAccess({ usersOnly: true });
  if (auth.response) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    updates?: Record<string, string[]>;
  } | null;

  if (!body?.updates || typeof body.updates !== "object") {
    return NextResponse.json({ message: "updates object is required." }, { status: 400 });
  }

  const updates: Record<string, PrincipalCapability[]> = {};
  for (const [roleId, caps] of Object.entries(body.updates)) {
    if (!Array.isArray(caps)) continue;
    updates[roleId] = caps.filter((c): c is PrincipalCapability =>
      (ALL_CAPABILITIES as readonly string[]).includes(c),
    );
  }

  const matrix = await saveRolePermissionMatrix(updates);
  return NextResponse.json(matrix);
}
