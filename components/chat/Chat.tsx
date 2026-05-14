"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChatMessage } from "@/lib/types";
import { useNotebookStore } from "@/store/notebook";
import { nanoid } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Send, Loader2, Bot, User, Settings } from "lucide-react";

interface Props {
  claudeApiKey: string;
  sphinxUrl: string;
  sphinxApiKey?: string;
  metabaseUrl: string;
  metabaseToken: string;
  databaseId: number;
  databaseName: string;
  schemaContext: string;
  onOpenSettings: () => void;
}

export function Chat({
  claudeApiKey, sphinxUrl, sphinxApiKey,
  metabaseUrl, metabaseToken, databaseId, databaseName,
  schemaContext, onOpenSettings,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { addCell, updateCell, applyFiltersToSql, cells } = useNotebookStore();

  const filterContext = cells
    .filter((c) => c.type === "filter" && c.filterConfig)
    .map((c) => `- {{${c.filterConfig!.variable}}} = ${JSON.stringify(c.filterConfig!.value ?? "(not set)")} (${c.filterConfig!.label})`)
    .join("\n");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");

    const userMsg: ChatMessage = { id: nanoid(), role: "user", content: text, timestamp: Date.now() };
    const assistantId = nanoid();
    const assistantMsg: ChatMessage = { id: assistantId, role: "assistant", content: "", timestamp: Date.now() };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    const apiMessages = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          claudeApiKey,
          sphinxUrl,
          sphinxApiKey,
          metabaseUrl,
          metabaseToken,
          databaseId,
          databaseName,
          schemaContext,
          filterContext,
        }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = JSON.parse(line.slice(6));

          if (payload.event === "text_delta") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + payload.text } : m
              )
            );
          } else if (payload.event === "error") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: `⚠️ ${payload.message}` }
                  : m
              )
            );
          } else if (payload.event === "tool_call") {
            if (payload.type === "execute_query") {
              // Add SQL cell
              const sqlCellId = addCell("sql", {
                sql: payload.sql,
                title: payload.title,
                status: payload.error ? "error" : "success",
                error: payload.error,
              });

              if (payload.result) {
                // Add result cell
                const resultCellId = addCell("result", {
                  title: payload.title,
                  result: payload.result,
                  sourceSqlCellId: sqlCellId,
                  status: "success",
                });

                // Add chart cell
                const chartCellId = addCell("chart", {
                  title: payload.title,
                  result: payload.result,
                  chartConfig: payload.chartConfig,
                  sourceSqlCellId: sqlCellId,
                  status: "success",
                });

                // Link cells
                updateCell(sqlCellId, { resultCellId, chartCellId });
              }
            } else if (payload.type === "add_filter_cell") {
              addCell("filter", {
                filterConfig: {
                  type: payload.filterType,
                  label: payload.label,
                  variable: payload.variable,
                  options: payload.options,
                  value: payload.filterType === "date_range" ? { from: "", to: "" }
                    : payload.filterType === "multi_select" ? []
                    : "",
                },
              });
            } else if (payload.type === "add_markdown_cell") {
              addCell("markdown", { markdown: payload.content });
            }
          }
        }
      }
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `Error: ${e instanceof Error ? e.message : String(e)}` }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, messages, claudeApiKey, sphinxUrl, sphinxApiKey, metabaseUrl, metabaseToken, databaseId, databaseName, schemaContext, filterContext, addCell, updateCell]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-full flex-col border-l border-zinc-800 bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-violet-400" />
          <span className="text-sm font-medium text-white">AI Assistant</span>
        </div>
        <button onClick={onOpenSettings} className="text-zinc-500 hover:text-zinc-300 p-1 rounded hover:bg-zinc-800">
          <Settings size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Bot size={32} className="mx-auto mb-3 text-zinc-600" />
            <p className="text-sm text-zinc-500">Ask me anything about your data.</p>
            <div className="mt-4 space-y-2">
              {[
                "What tables are available?",
                "Show me the top 10 products by revenue",
                "Add a date filter and show daily signups",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => { setInput(suggestion); textareaRef.current?.focus(); }}
                  className="block w-full rounded-lg border border-zinc-800 px-3 py-2 text-left text-xs text-zinc-400 hover:border-zinc-700 hover:text-zinc-300 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={cn("flex gap-2.5", msg.role === "user" && "flex-row-reverse")}>
            <div className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-0.5",
              msg.role === "user" ? "bg-violet-600" : "bg-zinc-700"
            )}>
              {msg.role === "user" ? <User size={11} className="text-white" /> : <Bot size={11} className="text-zinc-300" />}
            </div>
            <div className={cn(
              "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
              msg.role === "user"
                ? "bg-violet-600 text-white rounded-tr-sm"
                : "bg-zinc-800 text-zinc-200 rounded-tl-sm"
            )}>
              {msg.content || (isStreaming && msg.role === "assistant" ? (
                <Loader2 size={12} className="animate-spin text-zinc-400" />
              ) : null)}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-zinc-800 p-4">
        <div className="flex items-end gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 focus-within:border-violet-500 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your data… (Enter to send)"
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none max-h-32"
            style={{ scrollbarWidth: "none" }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40 transition-colors"
          >
            {isStreaming ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          </button>
        </div>
      </div>
    </div>
  );
}
