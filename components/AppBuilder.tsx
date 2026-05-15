"use client";

import { useState } from "react";
import { useNotebookStore } from "@/store/notebook";
import { AutoChart } from "./notebook/AutoChart";
import { FilterCell } from "./notebook/FilterCell";
import { ResultTable } from "./notebook/Cell";
import { cn } from "@/lib/utils";
import { BarChart2, Table } from "lucide-react";
import type { ChartType } from "@/lib/types";

function SqlCard({ cell }: { cell: ReturnType<typeof useNotebookStore.getState>["cells"][number] }) {
  const [view, setView] = useState<"table" | "chart">("table");
  const [chartType, setChartType] = useState<ChartType>("bar");

  if (!cell.result) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 flex items-center justify-center text-zinc-500 text-sm">
        {cell.title || "Query"} — no results yet
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <span className="text-sm font-medium text-zinc-200">{cell.title || "Query Result"}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView("table")}
            className={cn("flex items-center gap-1 rounded px-2 py-1 text-xs", view === "table" ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800")}
          >
            <Table size={10} /> Table
          </button>
          <button
            onClick={() => setView("chart")}
            className={cn("flex items-center gap-1 rounded px-2 py-1 text-xs", view === "chart" ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800")}
          >
            <BarChart2 size={10} /> Chart
          </button>
          {view === "chart" && (
            <div className="ml-1 flex items-center gap-0.5">
              {(["bar", "line", "area", "pie", "scatter"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setChartType(t)}
                  className={cn("rounded px-1.5 py-0.5 text-xs", chartType === t ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300")}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="p-4">
        {view === "table" ? (
          <ResultTable result={cell.result} />
        ) : (
          <AutoChart result={cell.result} config={{ type: chartType, ...cell.chartConfig }} />
        )}
        <p className="mt-2 text-xs text-zinc-600">{cell.result.rowCount} rows</p>
      </div>
    </div>
  );
}

export function AppBuilder() {
  const { cells, notebookTitle } = useNotebookStore();

  const filterCells = cells.filter((c) => c.type === "filter" && c.filterConfig);
  const contentCells = cells.filter((c) => c.type !== "filter");

  if (cells.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-500 text-sm">
        No content yet. Ask Claude to run some queries in the Notebook tab.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* App header with title + filters */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4">
        <h1 className="text-xl font-bold text-white mb-3">{notebookTitle}</h1>
        {filterCells.length > 0 && (
          <div className="flex flex-wrap items-center gap-4">
            {filterCells.map((cell) => (
              <FilterCell key={cell.id} cellId={cell.id} config={cell.filterConfig!} />
            ))}
          </div>
        )}
      </div>

      {/* Content cards */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {contentCells.map((cell) => {
          if (cell.type === "markdown") {
            return (
              <div key={cell.id} className="prose prose-invert prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-zinc-300 text-sm leading-relaxed bg-transparent border-0 p-0 m-0">
                  {cell.markdown || ""}
                </pre>
              </div>
            );
          }

          if (cell.type === "sql" || cell.type === "result") {
            return <SqlCard key={cell.id} cell={cell} />;
          }

          return null;
        })}
      </div>
    </div>
  );
}
