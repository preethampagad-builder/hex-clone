import { NextRequest, NextResponse } from "next/server";
import { drainEvents } from "@/lib/session-store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  const events = drainEvents(sessionId);
  return NextResponse.json({ events });
}
