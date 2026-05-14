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

  try {
    const res = await fetch(`${metabaseUrl.replace(/\/$/, "")}/api/dataset`, {
      method: "POST",
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

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Query failed: ${err}` }, { status: res.status });
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
