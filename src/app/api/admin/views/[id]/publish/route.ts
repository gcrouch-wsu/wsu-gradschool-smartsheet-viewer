import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/admin-api";
import { AdminActionError, updateAdminViewPublication } from "@/lib/admin-management";
import { auditFromPrincipal } from "@/lib/audit";
import { adminPrincipalToPrincipal } from "@/lib/identity";
import { revalidatePublicCatalog } from "@/lib/revalidate-public-catalog";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiAccess();
  if (auth.response) {
    return auth.response;
  }

  const { id } = await params;
  const body = ((await request.json().catch(() => null)) ?? {}) as { public?: boolean };

  try {
    const view = await updateAdminViewPublication(id, Boolean(body.public));
    revalidatePublicCatalog();
    await auditFromPrincipal(
      auth.principal ? adminPrincipalToPrincipal(auth.principal) : null,
      body.public ? "view.publish" : "view.unpublish",
      "view",
      id,
      { public: Boolean(body.public) },
    );
    return NextResponse.json({ view });
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
