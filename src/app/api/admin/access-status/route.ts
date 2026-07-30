import { NextResponse } from "next/server";
import { getAdminAccessStatus } from "@/lib/admin-users";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  const username =
    typeof (body as { username?: unknown })?.username === "string"
      ? (body as { username: string }).username.trim()
      : "";

  if (!username) {
    return NextResponse.json({ message: "Username is required." }, { status: 400 });
  }

  const result = await getAdminAccessStatus(username);
  if (!result.ok || !result.mode) {
    return NextResponse.json(
      { message: result.message ?? "Unable to continue." },
      { status: result.status ?? 400 },
    );
  }

  return NextResponse.json({ mode: result.mode });
}
