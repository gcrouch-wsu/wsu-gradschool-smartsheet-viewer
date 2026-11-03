import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/admin-api";
import { auditFromAdminPrincipal } from "@/lib/audit";
import { duplicateAdminView, AdminActionError } from "@/lib/admin-management";
import { revalidatePublicCatalog } from "@/lib/revalidate-public-catalog";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiAccess();
  if (auth.response) {
    return auth.response;
  }

  const { id } = await params;

  try {
    const view = await duplicateAdminView(id);
    await auditFromAdminPrincipal(auth.principal, "view.duplicate", "view", view.id, {
      sourceViewId: id,
    });
    revalidatePublicCatalog();
    return NextResponse.json({ view }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminActionError) {
      return NextResponse.json(
        { error: error.message, errors: error.errors, warnings: error.warnings },
        { status: error.status }
      );
    }

    throw error;
  }
}
