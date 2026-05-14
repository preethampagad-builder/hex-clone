import { NextRequest, NextResponse } from "next/server";
import { metabaseHeaders } from "@/lib/metabase-headers";

// In-memory cache: key = `${metabaseUrl}:${databaseId}`
const schemaCache = new Map<string, { schemaText: string; tables: unknown[]; engine: string; ts: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function GET(req: NextRequest) {
  const metabaseUrl = req.headers.get("x-metabase-url");
  const token = req.headers.get("x-metabase-token");
  const authType = req.headers.get("x-metabase-auth-type") ?? "session";
  const databaseId = req.nextUrl.searchParams.get("database_id");
  const bust = req.nextUrl.searchParams.get("bust") === "1";

  if (!metabaseUrl || !token || !databaseId) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const cacheKey = `${metabaseUrl}:${databaseId}`;
  const cached = schemaCache.get(cacheKey);
  if (cached && !bust && Date.now() - cached.ts < CACHE_TTL_MS) {
    console.log("[schema] serving from cache, age:", Math.round((Date.now() - cached.ts) / 1000) + "s");
    return NextResponse.json({ schemaText: cached.schemaText, tables: cached.tables, engine: cached.engine, cached: true });
  }

  try {
    const [metaRes, dbRes] = await Promise.all([
      fetch(
        `${metabaseUrl.replace(/\/$/, "")}/api/database/${databaseId}/metadata?include_hidden=false`,
        { headers: metabaseHeaders(token, authType) }
      ),
      fetch(
        `${metabaseUrl.replace(/\/$/, "")}/api/database/${databaseId}`,
        { headers: metabaseHeaders(token, authType) }
      ),
    ]);

    if (!metaRes.ok) {
      const body = await metaRes.text().catch(() => "");
      console.error("[schema] Metabase metadata error", metaRes.status, body.slice(0, 300));
      return NextResponse.json({ error: `Metabase returned ${metaRes.status}: ${body.slice(0, 200)}` }, { status: metaRes.status });
    }
    const data = await metaRes.json();
    const dbInfo = dbRes.ok ? await dbRes.json() : {};
    const engine: string = dbInfo.engine ?? "";

    const tables = (data.tables ?? []) as Array<{
      name: string;
      display_name: string;
      schema: string;
      fields: Array<{ name: string; base_type: string; description?: string }>;
    }>;

    const isBigQuery = engine === "bigquery" || engine === "bigquery-cloud-sdk";

    const schemaText = [
      `Database engine: ${engine || "unknown"}`,
      isBigQuery
        ? "IMPORTANT: BigQuery requires fully-qualified table names as dataset.table_name. Never use bare table names. Use backticks for multi-word aliases."
        : "",
      "",
      ...tables.map((t) => {
        const qualifiedName = t.schema ? `${t.schema}.${t.name}` : t.name;
        const cols = t.fields
          .map((f) => `  - ${f.name} (${f.base_type})${f.description ? `: ${f.description}` : ""}`)
          .join("\n");
        return `Table: ${qualifiedName}\n${cols}`;
      }),
    ]
      .filter(Boolean)
      .join("\n\n");

    console.log(`[schema] loaded ${tables.length} tables for db ${databaseId}, engine: ${engine}`);
    schemaCache.set(cacheKey, { schemaText, tables, engine, ts: Date.now() });
    return NextResponse.json({ schemaText, tables, engine });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
