import { NextRequest, NextResponse } from "next/server";
import { metabaseHeaders } from "@/lib/metabase-headers";

export async function GET(req: NextRequest) {
  const metabaseUrl = req.headers.get("x-metabase-url");
  const token = req.headers.get("x-metabase-token");
  const authType = req.headers.get("x-metabase-auth-type") ?? "session";
  if (!metabaseUrl || !token) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }
  try {
    const res = await fetch(`${metabaseUrl.replace(/\/$/, "")}/api/database`, {
      headers: metabaseHeaders(token, authType),
    });
    if (!res.ok) return NextResponse.json({ error: "Failed to list databases" }, { status: res.status });
    const data = await res.json();
    const dbs = (data.data ?? data).map((d: { id: number; name: string; engine: string }) => ({
      id: d.id,
      name: d.name,
      engine: d.engine,
    }));
    return NextResponse.json({ databases: dbs });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
