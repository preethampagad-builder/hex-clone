"use client";

import { useState } from "react";
import { MetabaseDatabase } from "@/lib/types";
import { Database, Loader2, ChevronDown, CheckCircle2, RefreshCw } from "lucide-react";

interface Props {
  databases: MetabaseDatabase[];
  selectedId: number | null;
  onSelect: (db: MetabaseDatabase) => void;
  isLoadingSchema: boolean;
}

export function DatabaseSelector({ databases, selectedId, onSelect, isLoadingSchema }: Props) {
  const [open, setOpen] = useState(false);
  const selected = databases.find((d) => d.id === selectedId);

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selected) onSelect(selected);
  };

  return (
    <div className="relative flex items-center gap-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-600 hover:text-white transition-colors"
      >
        <Database size={13} className="text-blue-400" />
        {selected ? (
          <span className="flex items-center gap-1.5">
            {selected.name}
            {isLoadingSchema
              ? <Loader2 size={11} className="animate-spin text-zinc-500" />
              : <CheckCircle2 size={11} className="text-emerald-500" />
            }
          </span>
        ) : databases.length === 0 ? (
          <span className="flex items-center gap-1.5 text-zinc-500">
            <Loader2 size={11} className="animate-spin" /> Loading…
          </span>
        ) : (
          <span className="text-zinc-500">Select database…</span>
        )}
        <ChevronDown size={12} className="text-zinc-500" />
      </button>

      {/* Reload schema button — shown when a DB is selected */}
      {selected && !isLoadingSchema && (
        <button
          onClick={handleRefresh}
          title="Reload schema"
          className="rounded p-1 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          <RefreshCw size={11} />
        </button>
      )}

      {open && databases.length > 0 && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
            {databases.map((db) => (
              <button
                key={db.id}
                onClick={() => { setOpen(false); onSelect(db); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white first:rounded-t-lg last:rounded-b-lg"
              >
                <Database size={12} className="text-blue-400 shrink-0" />
                <span className="truncate">{db.name}</span>
                <span className="ml-auto text-xs text-zinc-600">{db.engine}</span>
                {db.id === selectedId && <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
