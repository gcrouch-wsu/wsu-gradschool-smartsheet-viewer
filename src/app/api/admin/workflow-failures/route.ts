import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/admin-api";
import { listActivityFailures } from "@/lib/workflows/activity-failures";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApiAccess();
  if (auth.response) return auth.response;
  return NextResponse.json(await listActivityFailures());
}
