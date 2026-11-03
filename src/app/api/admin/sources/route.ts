import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/admin-api";
import { auditFromAdminPrincipal } from "@/lib/audit";
import { saveSourceConfig } from "@/lib/config/admin-store";
import { getSourceConfigById, listSourceConfigs } from "@/lib/config/store";
import { validateSourceConfig } from "@/lib/config/validation";
import { revalidatePublicCatalog } from "@/lib/revalidate-public-catalog";

export async function GET() {
  const auth = await requireAdminApiAccess();
  if (auth.response) {
    return auth.response;
  }

  return NextResponse.json({ sources: await listSourceConfigs() });
}

export async function POST(request: Request) {
  const auth = await requireAdminApiAccess();
  if (auth.response) {
    return auth.response;
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const result = validateSourceConfig(body);

  if (!result.success || !result.data) {
    return NextResponse.json({ errors: result.errors }, { status: 400 });
  }

  const existing = await getSourceConfigById(result.data.id);
  if (existing) {
    return NextResponse.json(
      {
        error: `A source with ID "${result.data.id}" already exists.`,
        errors: [`Use a different source id, or update the existing source with PUT /api/admin/sources/${result.data.id}.`],
      },
      { status: 409 },
    );
  }

  await saveSourceConfig(result.data);
  await auditFromAdminPrincipal(auth.principal, "source.create", "source", result.data.id, {
    label: result.data.label,
  });
  revalidatePublicCatalog();
  return NextResponse.json({ source: result.data }, { status: 201 });
}