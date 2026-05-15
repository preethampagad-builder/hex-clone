"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Cell as CellType, QueryResult } from "@/lib/types";
import { useNotebookStore } from "@/store/notebook";
import { AutoChart } from "./AutoChart";
import { FilterCell } from "./FilterCell";
import { cn } from "@/lib/utils";
import {
  Play, Trash2, ChevronUp, ChevronDown, BarChart2,
  Table, Filter, Code2, FileText, Loader2, AlertCircle,
} from "lucide-react";

// Bundle CodeMirror + extensions in one dynamic import so they share
// the same @codemirror/state instance and avoid the "multiple instances" error
const SqlEditor = dynamic(
  async () => {
    const [{ default: CodeMirror, oneDark }, { langs }] = await Promise.all([
      import("@uiw/react-codemirror"),
      import("@uiw/codemirror-extensions-langs"),
    ]);
    const sqlExt = langs.sql();
    return function SqlEditorInner({
      value, onChange,
    }: { value: string; onChange: (v: string) => void }) {
      return (
        <CodeMirror
          value={value}
          onChange={onChange}
          extensions={[sqlExt]}
          theme={oneDark}
          height="120px"
          basicSetup={{ lineNumbers: true, foldGutter: false }}
          className="rounded-lg overflow-hidden text-sm"
        />
      );
    };
  },
  { ssr: false }
);

export function ResultTable({ result }: { result: QueryResult }) {
  return (
    <div className="overflow-auto max-h-72 rounded-lg border border-zinc-800">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-700 bg-zinc-800/60">
            {result.columns.map((col) => (
              <th key={col} className="px-3 py-2 text-left font-medium text-zinc-400 whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.slice(0, 200).map((row, i) => (
            <tr key={i} className={cn("border-b border-zinc-800/50", i % 2 === 0 ? "bg-zinc-900" : "bg-zinc-800/30")}>
              {result.columns.map((col) => (
                <td key={col} className="px-3 py-1.5 text-zinc-300 whitespace-nowrap font-mono">
                  {row[col] === null ? <span className="text-zinc-600 italic">null</span> : String(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {result.rowCount > 200 && (
        <p className="py-2 text-center text-xs text-zinc-500">
          Showing 200 of {result.rowCount} rows
        </p>
      )}
    </div>
  );
}

interface Props {
  cell: CellType;
  metabaseUrl: string;
  metabaseToken: string;
  databaseId: number;
  onRun: (cellId: string) => void;
}

const TYPE_ICONS = {
  sql: <Code2 size={12} />,
  result: <Table size={12} />,
  chart: <BarChart2 size={12} />,
  filter: <Filter size={12} />,
  markdown: <FileText size={12} />,
};

const TYPE_LABELS = {
  sql: "SQL",
  result: "Result",
  chart: "Chart",
  filter: "Filter",
  markdown: "Markdown",
};

export function NotebookCell({ cell, onRun }: Props) {
  const { updateCell, removeCell, moveCell } = useNotebookStore();
  const [showTable, setShowTable] = useState(true);
  const [chartType, setChartType] = useState(cell.chartConfig?.type ?? "bar");
  const [sqlView, setSqlView] = useState<"table" | "chart">("table");

  const handleSqlChange = useCallback(
    (val: string) => updateCell(cell.id, { sql: val }),
    [cell.id, updateCell]
  );

  const handleMarkdownChange = useCallback(
    (val: string) => updateCell(cell.id, { markdown: val }),
    [cell.id, updateCell]
  );

  return (
    <div className={cn(
      "group relative rounded-xl border bg-zinc-900 transition-all",
      cell.status === "running" ? "border-violet-600/60" : "border-zinc-800 hover:border-zinc-700"
    )}>
      {/* Cell header */}
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2">
        <span className="flex items-center gap-1.5 text-xs text-zinc-500">
          {TYPE_ICONS[cell.type]}
          {TYPE_LABELS[cell.type]}
        </span>
        {cell.title && (
          <span className="text-xs font-medium text-zinc-300">{cell.title}</span>
        )}
        {cell.status === "running" && (
          <Loader2 size={12} className="animate-spin text-violet-400" />
        )}
        {cell.status === "error" && (
          <span className="flex items-center gap-1 text-xs text-red-400">
            <AlertCircle size={12} /> Error
          </span>
        )}
        {cell.result && cell.status === "success" && (
          <span className="text-xs text-zinc-500">
            {cell.result.rowCount} rows{cell.result.executionMs != null ? ` · ${cell.result.executionMs}ms` : ""}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {cell.type === "sql" && (
            <button
              onClick={() => onRun(cell.id)}
              disabled={cell.status === "running"}
              className="flex items-center gap-1 rounded bg-violet-600 px-2 py-1 text-xs text-white hover:bg-violet-500 disabled:opacity-50"
            >
              <Play size={10} />
              Run
            </button>
          )}
          <button onClick={() => moveCell(cell.id, "up")} className="rounded p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800">
            <ChevronUp size={12} />
          </button>
          <button onClick={() => moveCell(cell.id, "down")} className="rounded p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800">
            <ChevronDown size={12} />
          </button>
          <button onClick={() => removeCell(cell.id)} className="rounded p-1 text-zinc-500 hover:text-red-400 hover:bg-zinc-800">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Cell body */}
      <div className="p-4">
        {cell.type === "sql" && (
          <>
            <SqlEditor value={cell.sql ?? ""} onChange={handleSqlChange} />
            {cell.result && (cell.status === "success" || cell.status === "idle") && (
              <div className="mt-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <button
                    onClick={() => setSqlView("table")}
                    className={cn("flex items-center gap-1 rounded px-2 py-0.5 text-xs", sqlView === "table" ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800")}
                  >
                    <Table size={10} /> Table
                  </button>
                  <button
                    onClick={() => setSqlView("chart")}
                    className={cn("flex items-center gap-1 rounded px-2 py-0.5 text-xs", sqlView === "chart" ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800")}
                  >
                    <BarChart2 size={10} /> Chart
                  </button>
                  {sqlView === "chart" && (
                    <div className="ml-2 flex items-center gap-1">
                      {(["bar", "line", "area", "pie", "scatter"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setChartType(t)}
                          className={cn("rounded px-2 py-0.5 text-xs", chartType === t ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300")}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {sqlView === "table" ? (
                  <ResultTable result={cell.result} />
                ) : (
                  <AutoChart result={cell.result} config={{ type: chartType, ...cell.chartConfig }} />
                )}
              </div>
            )}
          </>
        )}

        {cell.type === "result" && cell.result && (
          <ResultTable result={cell.result} />
        )}

        {cell.type === "chart" && cell.result && cell.chartConfig && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs text-zinc-500">Chart type:</span>
              {(["bar", "line", "area", "pie", "scatter"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setChartType(t);
                    updateCell(cell.id, { chartConfig: { ...cell.chartConfig!, type: t } });
                  }}
                  className={cn(
                    "rounded px-2 py-0.5 text-xs",
                    chartType === t
                      ? "bg-violet-600 text-white"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <AutoChart result={cell.result} config={{ ...cell.chartConfig, type: chartType }} />
          </div>
        )}

        {cell.type === "filter" && cell.filterConfig && (
          <FilterCell cellId={cell.id} config={cell.filterConfig} />
        )}

        {cell.type === "markdown" && (
          <textarea
            value={cell.markdown ?? ""}
            onChange={(e) => handleMarkdownChange(e.target.value)}
            placeholder="# Title&#10;&#10;Add notes, context, or section headers…"
            rows={3}
            className="w-full resize-none rounded bg-transparent text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none"
          />
        )}

        {cell.error && (
          <div className="mt-3 rounded-lg bg-red-950/50 border border-red-800 p-3 text-xs text-red-300">
            {cell.error}
          </div>
        )}
      </div>
    </div>
  );
}
