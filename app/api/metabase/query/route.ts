import { NextRequest, NextResponse } from "next/server";
import { metabaseHeaders } from "@/lib/metabase-headers";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const metabaseUrl = req.headers.get("x-metabase-url");
  const token = req.headers.get("x-metabase-token");
  const authType = req.headers.get("x-metabase-auth-type") ?? "session";
  const { databaseId, sql } = await req.json();

  if (!metabaseUrl || !token || !databaseId || !sql) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  // Enforce HTTPS to prevent POST→GET redirect (which yields nginx 405)
  const baseUrl = metabaseUrl.replace(/\/$/, "").replace(/^http:\/\//i, "https://");

  try {
    const res = await fetch(`${baseUrl}/api/dataset`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/json",
        ...metabaseHeaders(token, authType),
      },
      body: JSON.stringify({
        database: databaseId,
        type: "native",
        native: { query: sql },
      }),
    });

    // If Metabase redirects (301/302) the POST, the API key / URL is likely wrong
    if (res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308) {
      const location = res.headers.get("location") ?? "(unknown)";
      return NextResponse.json(
        { error: `Metabase redirected to ${location}. Check the Metabase URL and API key.` },
        { status: 400 }
      );
    }

    if (!res.ok) {
      const body = await res.text();
      const detail = body.includes("<!") ? `HTTP ${res.status}` : body;
      return NextResponse.json(
        { error: `Metabase returned ${res.status}: ${detail} (URL: ${baseUrl}, authType: ${authType})` },
        { status: res.status }
      );
    }

    const data = await res.json();
    if (data.error) return NextResponse.json({ error: data.error }, { status: 400 });

    const cols = (data.data?.cols ?? []) as Array<{ name: string }>;
    const rows = (data.data?.rows ?? []) as unknown[][];
    const columns = cols.map((c) => c.name);
    const mappedRows = rows.map((row) =>
      Object.fromEntries(columns.map((col, i) => [col, row[i]]))
    );

    return NextResponse.json({
      columns,
      rows: mappedRows,
      rowCount: mappedRows.length,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
