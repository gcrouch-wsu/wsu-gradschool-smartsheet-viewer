import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/admin-api";
import { auditFromAdminPrincipal } from "@/lib/audit";
import { saveAdminViewConfig, deleteAdminView, AdminActionError } from "@/lib/admin-management";
import { getViewConfigById, listSourceConfigs } from "@/lib/config/store";
import { validateViewConfig } from "@/lib/config/validation";
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
  const view = await getViewConfigById(id);

  if (!view) {
    return NextResponse.json({ error: `View "${id}" was not found.` }, { status: 404 });
  }

  return NextResponse.json({ view });
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
  const existingView = await getViewConfigById(id);
  if (!existingView) {
    return NextResponse.json({ error: `View "${id}" was not found.` }, { status: 404 });
  }

  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const sources = await listSourceConfigs();
  const result = validateViewConfig({ ...body, id }, { knownSourceIds: sources.map((source) => source.id), sources });

  if (!result.success || !result.data) {
    return NextResponse.json({ errors: result.errors }, { status: 400 });
  }
  result.data.public = existingView.public;

  try {
    const view = await saveAdminViewConfig(result.data);
    await auditFromAdminPrincipal(auth.principal, "view.update", "view", view.id, {
      sourceId: view.sourceId,
    });
    revalidatePublicCatalog();
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
    await deleteAdminView(id);
    await auditFromAdminPrincipal(auth.principal, "view.delete", "view", id);
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