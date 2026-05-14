import { NextRequest, NextResponse } from "next/server";
import { createSession, getSession, pingSession, updateSession } from "@/lib/session-store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { metabaseUrl, metabaseToken, metabaseAuthType, databaseId, databaseName } = await req.json();
  if (!metabaseUrl || !metabaseToken || !databaseId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const resolvedAuthType = metabaseToken?.startsWith("mb_") ? "apikey" : (metabaseAuthType ?? "session");
  const sessionId = await createSession({ metabaseUrl, metabaseToken, metabaseAuthType: resolvedAuthType, databaseId, databaseName: databaseName ?? "" });
  return NextResponse.json({ sessionId });
}

export async function PATCH(req: NextRequest) {
  const { session_id, metabaseAuthType } = await req.json();
  if (!session_id) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  await updateSession(session_id, { metabaseAuthType });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  const session = await getSession(sessionId);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  await pingSession(sessionId);
  return NextResponse.json({ ok: true, databaseId: session.databaseId, databaseName: session.databaseName, metabaseAuthType: session.metabaseAuthType, metabaseUrl: session.metabaseUrl });
}
