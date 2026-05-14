"use client";

import { useState } from "react";
import { FilterConfig, DateRange } from "@/lib/types";
import { useNotebookStore } from "@/store/notebook";
import { cn } from "@/lib/utils";
import { X, Calendar, Search, Tag } from "lucide-react";

interface Props {
  cellId: string;
  config: FilterConfig;
}

export function FilterCell({ cellId, config }: Props) {
  const updateCell = useNotebookStore((s) => s.updateCell);
  const cells = useNotebookStore((s) => s.cells);
  const [tag, setTag] = useState("");

  const setValue = (val: FilterConfig["value"]) => {
    updateCell(cellId, {
      filterConfig: { ...config, value: val },
    });
  };

  const addTag = () => {
    if (!tag.trim()) return;
    const current = Array.isArray(config.value) ? config.value : [];
    if (!current.includes(tag.trim())) {
      setValue([...current, tag.trim()]);
    }
    setTag("");
  };

  const removeTag = (t: string) => {
    const current = Array.isArray(config.value) ? config.value : [];
    setValue(current.filter((v) => v !== t));
  };

  const iconMap = {
    date_range: <Calendar size={12} />,
    text: <Search size={12} />,
    multi_select: <Tag size={12} />,
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
        {iconMap[config.type]}
        <span className="font-medium text-zinc-300">{config.label}</span>
        <span className="text-zinc-600 font-mono">{`{{${config.variable}}}`}</span>
      </div>

      {config.type === "date_range" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={(config.value as DateRange)?.from ?? ""}
            onChange={(e) =>
              setValue({ from: e.target.value, to: (config.value as DateRange)?.to ?? "" })
            }
            className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-white focus:border-violet-500 focus:outline-none"
          />
          <span className="text-zinc-500 text-xs">to</span>
          <input
            type="date"
            value={(config.value as DateRange)?.to ?? ""}
            onChange={(e) =>
              setValue({ from: (config.value as DateRange)?.from ?? "", to: e.target.value })
            }
            className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-white focus:border-violet-500 focus:outline-none"
          />
        </div>
      )}

      {config.type === "text" && (
        <input
          type="text"
          value={(config.value as string) ?? ""}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`Filter by ${config.label}…`}
          className="w-56 rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
        />
      )}

      {config.type === "multi_select" && (
        <div className="flex flex-wrap items-center gap-1.5">
          {(Array.isArray(config.value) ? config.value : []).map((v) => (
            <span
              key={v}
              className="flex items-center gap-1 rounded-full bg-violet-900/50 border border-violet-700 px-2 py-0.5 text-xs text-violet-200"
            >
              {v}
              <button onClick={() => removeTag(v)} className="text-violet-400 hover:text-violet-200">
                <X size={10} />
              </button>
            </span>
          ))}
          {config.options?.length ? (
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  const current = Array.isArray(config.value) ? config.value : [];
                  if (!current.includes(e.target.value)) setValue([...current, e.target.value]);
                }
              }}
              className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 focus:border-violet-500 focus:outline-none"
            >
              <option value="">+ Add…</option>
              {config.options.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          ) : (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTag()}
                placeholder="Type & Enter…"
                className="w-28 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
