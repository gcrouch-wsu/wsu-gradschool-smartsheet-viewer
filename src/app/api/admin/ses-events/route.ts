import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/admin-api";
import { listSesEvents } from "@/lib/ses/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminApiAccess();
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const result = await listSesEvents({
    kind: url.searchParams.get("kind"),
    query: url.searchParams.get("q"),
  });
  return NextResponse.json(result);
}
