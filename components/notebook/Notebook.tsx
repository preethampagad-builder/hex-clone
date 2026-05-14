"use client";

import { useCallback } from "react";
import { useNotebookStore } from "@/store/notebook";
import { NotebookCell } from "./Cell";
import { cn } from "@/lib/utils";
import { Plus, Code2, Filter, FileText } from "lucide-react";

interface Props {
  metabaseUrl: string;
  metabaseToken: string;
  databaseId: number;
  onRunCell: (cellId: string) => void;
}

export function Notebook({ metabaseUrl, metabaseToken, databaseId, onRunCell }: Props) {
  const { cells, addCell, notebookTitle, setTitle } = useNotebookStore();

  const handleAddSql = () => addCell("sql", { sql: "SELECT\n  *\nFROM\n  " });
  const handleAddFilter = () =>
    addCell("filter", {
      filterConfig: {
        type: "date_range",
        label: "Date range",
        variable: "date_range",
        value: { from: "", to: "" },
      },
    });
  const handleAddMarkdown = () => addCell("markdown", { markdown: "" });

  return (
    <div className="flex h-full flex-col">
      {/* Notebook title */}
      <div className="border-b border-zinc-800 px-6 py-4">
        <input
          value={notebookTitle}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-transparent text-2xl font-bold text-white placeholder-zinc-600 focus:outline-none"
          placeholder="Untitled Analysis"
        />
      </div>

      {/* Cells */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {cells.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-zinc-500 text-sm">
              Start by asking a question in the chat, or add a cell below.
            </p>
          </div>
        )}

        {cells.map((cell) => (
          <NotebookCell
            key={cell.id}
            cell={cell}
            metabaseUrl={metabaseUrl}
            metabaseToken={metabaseToken}
            databaseId={databaseId}
            onRun={onRunCell}
          />
        ))}
      </div>

      {/* Add cell bar */}
      <div className="border-t border-zinc-800 px-6 py-3 flex items-center gap-2">
        <span className="text-xs text-zinc-600 mr-1">Add cell:</span>
        {[
          { icon: <Code2 size={12} />, label: "SQL", fn: handleAddSql },
          { icon: <Filter size={12} />, label: "Filter", fn: handleAddFilter },
          { icon: <FileText size={12} />, label: "Markdown", fn: handleAddMarkdown },
        ].map(({ icon, label, fn }) => (
          <button
            key={label}
            onClick={fn}
            className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-600 hover:text-white transition-colors"
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
