import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/admin-api";
import { listAuditEvents } from "@/lib/audit";

export async function GET(request: Request) {
  const auth = await requireAdminApiAccess();
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "100");
  const actorId = url.searchParams.get("actorId") ?? undefined;
  const resourceType = url.searchParams.get("resourceType") ?? undefined;
  const resourceId = url.searchParams.get("resourceId") ?? undefined;

  const events = await listAuditEvents({
    limit: Number.isFinite(limit) ? limit : 100,
    actorId,
    resourceType,
    resourceId,
  });

  return NextResponse.json({ events });
}
