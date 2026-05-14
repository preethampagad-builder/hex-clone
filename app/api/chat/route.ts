import { NextRequest } from "next/server";
import { runOrchestrator } from "@/lib/agents/orchestrator";
import { QueryResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const {
    messages,
    claudeApiKey,
    sphinxUrl,
    sphinxApiKey,
    metabaseUrl,
    metabaseToken,
    databaseId,
    databaseName,
    schemaContext,
    filterContext,
  } = await req.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ event, ...((typeof data === "object" && data !== null) ? data : { value: data }) })}\n\n`)
        );
      };

      // Debug: log what context Claude is receiving
      console.log("[chat] schemaContext length:", schemaContext?.length ?? 0);
      console.log("[chat] sphinxUrl:", sphinxUrl ? "set" : "not set");
      console.log("[chat] sphinxApiKey:", sphinxApiKey ? "set" : "not set");

      const executeQuery = async (sql: string): Promise<QueryResult> => {
        const res = await fetch(`${req.nextUrl.origin}/api/metabase/query`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-metabase-url": metabaseUrl,
            "x-metabase-token": metabaseToken,
            "x-metabase-auth-type": "apikey",
          },
          body: JSON.stringify({ databaseId, sql }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error ?? "Query failed");
        return data;
      };

      try {
        const gen = runOrchestrator(
          messages,
          { claudeApiKey, sphinxUrl, sphinxApiKey, schemaContext, filterContext, databaseName },
          executeQuery
        );

        for await (const evt of gen) {
          if (evt.event === "text_delta") {
            send("text_delta", { text: evt.text });
          } else if (evt.event === "tool_call") {
            send("tool_call", evt.data);
          } else if (evt.event === "done") {
            send("done", {});
          } else if (evt.event === "error") {
            send("error", { message: evt.message });
          }
        }
      } catch (e) {
        send("error", { message: String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
