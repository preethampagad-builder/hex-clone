/**
 * MCP JSON-RPC 2.0 server endpoint.
 * Claude.ai connects here as a custom MCP server.
 * Tools push events to the session store; the browser polls /api/poll to apply them.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession, pushEvent } from "@/lib/session-store";
import { metabaseHeaders } from "@/lib/metabase-headers";

export const runtime = "nodejs";
export const maxDuration = 60;

// ── MCP protocol types ────────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: unknown;
}

function ok(id: string | number | null, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

function err(id: string | number | null, code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } });
}

// ── Tool definitions (returned to Claude.ai on initialize/list) ───────────────

const TOOLS = [
  {
    name: "execute_query",
    description: "Execute a SQL query against the connected Metabase database (BigQuery) and add the results as a cell in the notebook. Use fully-qualified table names: dataset.table_name. Use Sphinx for schema/table context before writing queries.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Session ID from the ConnectPanel" },
        sql: { type: "string", description: "SQL query to execute" },
        title: { type: "string", description: "Optional title for the cell" },
      },
      required: ["session_id", "sql"],
    },
  },
  {
    name: "add_filter",
    description: "Add an interactive filter cell to the notebook that users can change without re-running queries. SQL cells can reference the filter with {{filter_name}}.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Session ID from the ConnectPanel" },
        name: { type: "string", description: "Filter variable name (used as {{name}} in SQL)" },
        label: { type: "string", description: "Display label shown to users" },
        type: { type: "string", enum: ["text", "number", "date", "select"], description: "Filter input type" },
        defaultValue: { type: "string", description: "Default value for the filter" },
        options: { type: "array", items: { type: "string" }, description: "Options list for select type" },
      },
      required: ["session_id", "name", "label", "type"],
    },
  },
  {
    name: "add_markdown",
    description: "Add a markdown text cell to the notebook (headings, explanations, analysis summaries).",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Session ID from the ConnectPanel" },
        content: { type: "string", description: "Markdown content" },
      },
      required: ["session_id", "content"],
    },
  },
  {
    name: "remove_cell",
    description: "Remove a cell from the notebook by its ID.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Session ID from the ConnectPanel" },
        cell_id: { type: "string", description: "ID of the cell to remove" },
      },
      required: ["session_id", "cell_id"],
    },
  },
  {
    name: "list_cells",
    description: "List all current cells in the notebook (IDs, types, titles, SQL).",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Session ID from the ConnectPanel" },
      },
      required: ["session_id"],
    },
  },
];

// ── Request origin validation ─────────────────────────────────────────────────

function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

// ── Tool handlers ─────────────────────────────────────────────────────────────

async function handleExecuteQuery(
  args: { session_id: string; sql: string; title?: string },
  baseUrl: string
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const session = await getSession(args.session_id);
  if (!session) throw new Error("Session not found. Regenerate the Session ID from the ConnectPanel and try again.");

  if (!session.databaseId) throw new Error("No database selected in this session. Select a database in the app first.");

  // Re-derive auth type from token prefix in case it was stored wrong
  const effectiveAuthType = session.metabaseToken?.startsWith("mb_") ? "apikey" : session.metabaseAuthType;

  const res = await fetch(`${baseUrl}/api/metabase/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-metabase-url": session.metabaseUrl,
      "x-metabase-token": session.metabaseToken,
      "x-metabase-auth-type": effectiveAuthType,
    },
    body: JSON.stringify({ databaseId: session.databaseId, sql: args.sql }),
  });

  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error ?? "Query failed");

  const columns: string[] = data.columns ?? [];
  const rows: Record<string, unknown>[] = data.rows ?? [];

  await pushEvent(args.session_id, "add_cells", {
    sql: args.sql,
    title: args.title ?? "",
    result: data,
  });

  const preview = rows
    .slice(0, 5)
    .map((row) => columns.map((c) => `${c}: ${row[c] ?? ""}`).join(", "))
    .join("\n");

  return {
    content: [
      {
        type: "text",
        text: `Query executed successfully. ${rows.length} rows returned.\nColumns: ${columns.join(", ")}\n\nFirst 5 rows:\n${preview || "(no data)"}`,
      },
    ],
  };
}

async function handleAddFilter(args: {
  session_id: string;
  name: string;
  label: string;
  type: string;
  defaultValue?: string;
  options?: string[];
}): Promise<{ content: Array<{ type: string; text: string }> }> {
  const session = await getSession(args.session_id);
  if (!session) throw new Error("Session not found.");

  await pushEvent(args.session_id, "add_filter", {
    name: args.name,
    label: args.label,
    type: args.type,
    defaultValue: args.defaultValue ?? "",
    options: args.options ?? [],
  });

  return {
    content: [
      {
        type: "text",
        text: `Filter "${args.label}" ({{${args.name}}}) added to notebook. SQL queries can reference it with {{${args.name}}}.`,
      },
    ],
  };
}

async function handleAddMarkdown(args: {
  session_id: string;
  content: string;
}): Promise<{ content: Array<{ type: string; text: string }> }> {
  const session = await getSession(args.session_id);
  if (!session) throw new Error("Session not found.");

  await pushEvent(args.session_id, "add_markdown", { content: args.content });

  return { content: [{ type: "text", text: "Markdown cell added to notebook." }] };
}

async function handleRemoveCell(args: {
  session_id: string;
  cell_id: string;
}): Promise<{ content: Array<{ type: string; text: string }> }> {
  const session = await getSession(args.session_id);
  if (!session) throw new Error("Session not found.");

  await pushEvent(args.session_id, "remove_cell", { cellId: args.cell_id });

  return { content: [{ type: "text", text: `Cell ${args.cell_id} removed.` }] };
}

async function handleListCells(args: {
  session_id: string;
}): Promise<{ content: Array<{ type: string; text: string }> }> {
  const session = await getSession(args.session_id);
  if (!session) throw new Error("Session not found.");

  // We can't directly read the browser notebook state from the server,
  // so return a helpful message and the session info
  return {
    content: [
      {
        type: "text",
        text: `Connected to database "${session.databaseName}" (ID: ${session.databaseId}). Use get_schema to see available tables, then execute_query to add cells. The notebook is rendered in the user's browser — cells you add via execute_query, add_filter, and add_markdown will appear there automatically.`,
      },
    ],
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: JsonRpcRequest;
  try {
    body = await req.json();
  } catch {
    return err(null, -32700, "Parse error");
  }

  const { id, method, params } = body;
  const baseUrl = getBaseUrl(req);

  // MCP initialize handshake
  if (method === "initialize") {
    return ok(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "hex-notebook", version: "1.0.0" },
    });
  }

  if (method === "notifications/initialized") {
    return new NextResponse(null, { status: 204 });
  }

  // List tools
  if (method === "tools/list") {
    return ok(id, { tools: TOOLS });
  }

  // Call tool
  if (method === "tools/call") {
    const { name, arguments: args } = params as { name: string; arguments: Record<string, unknown> };

    try {
      let result;
      if (name === "execute_query") result = await handleExecuteQuery(args as Parameters<typeof handleExecuteQuery>[0], baseUrl);
      else if (name === "add_filter") result = await handleAddFilter(args as Parameters<typeof handleAddFilter>[0]);
      else if (name === "add_markdown") result = await handleAddMarkdown(args as Parameters<typeof handleAddMarkdown>[0]);
      else if (name === "remove_cell") result = await handleRemoveCell(args as Parameters<typeof handleRemoveCell>[0]);
      else if (name === "list_cells") result = await handleListCells(args as Parameters<typeof handleListCells>[0]);
      else return err(id, -32601, `Unknown tool: ${name}`);

      return ok(id, result);
    } catch (e) {
      return ok(id, {
        content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
        isError: true,
      });
    }
  }

  // Ping / keepalive
  if (method === "ping") {
    return ok(id, {});
  }

  return err(id, -32601, `Method not found: ${method}`);
}

// Claude.ai probes with GET for SSE capability — return a minimal SSE stream
export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(": ping\n\n"));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
