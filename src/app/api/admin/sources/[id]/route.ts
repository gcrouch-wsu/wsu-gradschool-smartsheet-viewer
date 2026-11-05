import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/admin-api";
import { auditFromAdminPrincipal } from "@/lib/audit";
import { saveSourceConfig } from "@/lib/config/admin-store";
import { deleteAdminSource, AdminActionError } from "@/lib/admin-management";
import { getSourceConfigById } from "@/lib/config/store";
import { validateSourceConfig } from "@/lib/config/validation";
import { revalidatePublicCatalog } from "@/lib/revalidate-public-catalog";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiAccess();
  if (auth.response) {
    return auth.response;
  }

  const { id } = await params;
  const source = await getSourceConfigById(id);

  if (!source) {
    return NextResponse.json({ error: `Source "${id}" was not found.` }, { status: 404 });
  }

  return NextResponse.json({ source });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiAccess();
  if (auth.response) {
    return auth.response;
  }

  const { id } = await params;
  const existing = await getSourceConfigById(id);
  if (!existing) {
    return NextResponse.json({ error: `Source "${id}" was not found.` }, { status: 404 });
  }

  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const result = validateSourceConfig({ ...body, id });

  if (!result.success || !result.data) {
    return NextResponse.json({ errors: result.errors }, { status: 400 });
  }

  await saveSourceConfig(result.data);
  await auditFromAdminPrincipal(auth.principal, "source.update", "source", result.data.id, {
    label: result.data.label,
  });
  revalidatePublicCatalog();
  return NextResponse.json({ source: result.data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiAccess();
  if (auth.response) {
    return auth.response;
  }

  const { id } = await params;

  try {
    await deleteAdminSource(id);
    await auditFromAdminPrincipal(auth.principal, "source.delete", "source", id);
    revalidatePublicCatalog();
    return NextResponse.json({ ok: true });
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