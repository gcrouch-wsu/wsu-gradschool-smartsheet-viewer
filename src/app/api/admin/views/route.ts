import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/admin-api";
import { auditFromAdminPrincipal } from "@/lib/audit";
import { saveAdminViewConfig, AdminActionError } from "@/lib/admin-management";
import { listSourceConfigs, listViewConfigs } from "@/lib/config/store";
import { validateViewConfig } from "@/lib/config/validation";
import { revalidatePublicCatalog } from "@/lib/revalidate-public-catalog";

export async function GET() {
  const auth = await requireAdminApiAccess();
  if (auth.response) {
    return auth.response;
  }

  return NextResponse.json({ views: await listViewConfigs() });
}

export async function POST(request: Request) {
  const auth = await requireAdminApiAccess();
  if (auth.response) {
    return auth.response;
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const sources = await listSourceConfigs();
  const result = validateViewConfig(body, { knownSourceIds: sources.map((source) => source.id), sources });

  if (!result.success || !result.data) {
    return NextResponse.json({ errors: result.errors }, { status: 400 });
  }

  result.data.public = false;

  try {
    const view = await saveAdminViewConfig(result.data, { rejectOnExistingId: true });
    await auditFromAdminPrincipal(auth.principal, "view.create", "view", view.id, {
      label: view.label,
      sourceId: view.sourceId,
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
