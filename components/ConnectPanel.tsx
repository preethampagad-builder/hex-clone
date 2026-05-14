"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Copy, Check, Wifi, WifiOff, RefreshCw, Info } from "lucide-react";
import { useNotebookStore } from "@/store/notebook";

interface Props {
  metabaseUrl: string;
  metabaseToken: string;
  metabaseAuthType: string;
  databaseId: number;
  databaseName: string;
  onOpenSettings: () => void;
}

type ConnectionState = "idle" | "connecting" | "connected" | "error";

export function ConnectPanel({
  metabaseUrl,
  metabaseToken,
  metabaseAuthType,
  databaseId,
  databaseName,
  onOpenSettings,
}: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connState, setConnState] = useState<ConnectionState>("idle");
  const [copied, setCopied] = useState(false);
  const [lastPoll, setLastPoll] = useState<number | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { addCell, removeCell, updateCell } = useNotebookStore();

  // Create or recreate session whenever credentials/db change
  const startSession = useCallback(async () => {
    if (!metabaseUrl || !metabaseToken || !databaseId) return;
    setConnState("connecting");
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metabaseUrl, metabaseToken, metabaseAuthType, databaseId, databaseName }),
      });
      const data = await res.json();
      if (!res.ok || !data.sessionId) throw new Error(data.error ?? "Failed to create session");
      setSessionId(data.sessionId);
      setConnState("connected");
    } catch {
      setConnState("error");
    }
  }, [metabaseUrl, metabaseToken, metabaseAuthType, databaseId, databaseName]);

  useEffect(() => {
    startSession();
  }, [startSession]);

  // Poll for events while connected
  useEffect(() => {
    if (!sessionId || connState !== "connected") return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/poll?session_id=${sessionId}`);
        if (!res.ok) return;
        const { events } = await res.json() as { events: Array<{ id: string; type: string; data: unknown }> };
        if (events.length > 0) {
          setEventCount((c) => c + events.length);
          setLastPoll(Date.now());
          applyEvents(events);
        }
      } catch {}
    };

    pollRef.current = setInterval(poll, 2000);
    poll(); // immediate first poll
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, connState]);

  const applyEvents = (events: Array<{ id: string; type: string; data: unknown }>) => {
    for (const evt of events) {
      if (evt.type === "add_cells") {
        const d = evt.data as { sql: string; title?: string; result?: import("@/lib/types").QueryResult };
        const sqlId = addCell("sql", { sql: d.sql, title: d.title, status: d.result ? "success" : "idle", result: d.result });
        void sqlId;
      } else if (evt.type === "add_filter") {
        const d = evt.data as { name: string; label: string; type: string; defaultValue?: string; options?: string[] };
        const filterTypeMap: Record<string, import("@/lib/types").FilterType> = {
          text: "text", number: "text", date: "date_range", select: "multi_select",
        };
        addCell("filter", {
          filterConfig: {
            variable: d.name,
            label: d.label,
            type: filterTypeMap[d.type] ?? "text",
            value: d.defaultValue ?? "",
            options: d.options ?? [],
          },
        });
      } else if (evt.type === "add_markdown") {
        const d = evt.data as { content: string };
        addCell("markdown", { markdown: d.content });
      } else if (evt.type === "remove_cell") {
        const d = evt.data as { cellId: string };
        removeCell(d.cellId);
      }
    }
  };

  const mcpUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/mcp`
    : "/api/mcp";

  const copySessionId = () => {
    if (sessionId) {
      navigator.clipboard.writeText(sessionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyMcpUrl = () => {
    navigator.clipboard.writeText(mcpUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isReady = connState === "connected" && !!sessionId;

  return (
    <div className="flex flex-col h-full border-l border-zinc-800 bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          {connState === "connected" ? (
            <Wifi size={14} className="text-emerald-500" />
          ) : connState === "error" ? (
            <WifiOff size={14} className="text-red-500" />
          ) : (
            <Wifi size={14} className="text-zinc-600" />
          )}
          <span className="text-sm font-medium text-zinc-200">Claude MCP Connect</span>
        </div>
        {connState === "error" && (
          <button
            onClick={startSession}
            className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
          >
            <RefreshCw size={10} /> Retry
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Status */}
        <div className={`rounded-lg px-3 py-2 text-xs ${
          connState === "connected" ? "bg-emerald-950/50 text-emerald-400 border border-emerald-900"
          : connState === "error" ? "bg-red-950/50 text-red-400 border border-red-900"
          : "bg-zinc-900 text-zinc-500 border border-zinc-800"
        }`}>
          {connState === "connecting" && "Creating session…"}
          {connState === "connected" && `Connected to ${databaseName || "database"} · ${eventCount} events applied`}
          {connState === "error" && "Failed to create session — check settings"}
          {connState === "idle" && "Select a database to start"}
        </div>

        {/* Step 1: MCP URL */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Step 1 · Add MCP server in Claude.ai</p>
          <p className="text-xs text-zinc-500">
            In Claude.ai → Settings → Integrations → Add custom integration, paste this URL:
          </p>
          <div className="flex items-center gap-2 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2">
            <code className="flex-1 text-xs text-violet-300 truncate">{mcpUrl}</code>
            <button
              onClick={copyMcpUrl}
              className="shrink-0 text-zinc-500 hover:text-zinc-200 transition-colors"
              title="Copy MCP URL"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            </button>
          </div>
        </div>

        {/* Step 2: Session ID */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Step 2 · Copy session ID</p>
          <p className="text-xs text-zinc-500">
            Give this to Claude so it can connect to your notebook session. Say:
          </p>
          <div className="rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs text-zinc-400 italic leading-relaxed">
            {`"Use session_id `}<span className="text-violet-300 font-mono not-italic">{sessionId ?? "…"}</span>{`"`}
          </div>
          {sessionId && (
            <div className="flex items-center gap-2 rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2">
              <code className="flex-1 text-xs text-violet-300 truncate font-mono">{sessionId}</code>
              <button
                onClick={copySessionId}
                className="shrink-0 text-zinc-500 hover:text-zinc-200 transition-colors"
                title="Copy session ID"
              >
                {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              </button>
            </div>
          )}
          {!sessionId && connState !== "error" && (
            <div className="text-xs text-zinc-600 italic">Select a database first…</div>
          )}
          <button
            onClick={startSession}
            disabled={!databaseId}
            className="text-xs text-zinc-600 hover:text-zinc-400 flex items-center gap-1 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={10} /> Regenerate session ID
          </button>
        </div>

        {/* Step 3: What to say */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Step 3 · Chat with Claude.ai</p>
          <p className="text-xs text-zinc-500">
            Claude uses Sphinx for context, writes SQL, executes against Metabase, and renders results in this notebook.
          </p>
          <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3 space-y-2 text-xs text-zinc-500">
            <p className="text-zinc-300 font-medium">Example prompts:</p>
            <ul className="space-y-1.5 list-none">
              <li className="text-zinc-400">· Show me revenue by month for the last 6 months</li>
              <li className="text-zinc-400">· Add a date range filter then query daily orders</li>
              <li className="text-zinc-400">· Which products have the highest return rate?</li>
            </ul>
          </div>
        </div>

        {/* Activity */}
        {lastPoll && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-600">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
            Polling · last event {Math.round((Date.now() - lastPoll) / 1000)}s ago
          </div>
        )}

        {/* Settings link */}
        <div className="border-t border-zinc-800 pt-4">
          <button
            onClick={onOpenSettings}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            ⚙ Change Metabase credentials
          </button>
        </div>
      </div>
    </div>
  );
}
