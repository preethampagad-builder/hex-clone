"use client";

import { create } from "zustand";
import { Cell, CellType, FilterConfig, ChartConfig, QueryResult } from "@/lib/types";
import { nanoid } from "@/lib/utils";

interface NotebookState {
  cells: Cell[];
  selectedDatabaseId: number | null;
  notebookTitle: string;
  addCell: (type: CellType, partial?: Partial<Cell>) => string;
  updateCell: (id: string, patch: Partial<Cell>) => void;
  removeCell: (id: string) => void;
  moveCell: (id: string, direction: "up" | "down") => void;
  setDatabase: (id: number) => void;
  setTitle: (title: string) => void;
  getFilterValues: () => Record<string, unknown>;
  applyFiltersToSql: (sql: string) => string;
}

export const useNotebookStore = create<NotebookState>((set, get) => ({
  cells: [],
  selectedDatabaseId: null,
  notebookTitle: "Untitled Analysis",

  addCell: (type, partial = {}) => {
    const id = nanoid();
    const cell: Cell = {
      id,
      type,
      status: "idle",
      createdAt: Date.now(),
      ...partial,
    };
    set((s) => ({ cells: [...s.cells, cell] }));
    return id;
  },

  updateCell: (id, patch) => {
    set((s) => ({
      cells: s.cells.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  },

  removeCell: (id) => {
    set((s) => {
      const cell = s.cells.find((c) => c.id === id);
      // Remove linked result/chart cells too
      const linkedIds = new Set([
        id,
        cell?.resultCellId,
        cell?.chartCellId,
      ].filter(Boolean) as string[]);
      return { cells: s.cells.filter((c) => !linkedIds.has(c.id)) };
    });
  },

  moveCell: (id, direction) => {
    set((s) => {
      const idx = s.cells.findIndex((c) => c.id === id);
      if (idx === -1) return s;
      const newCells = [...s.cells];
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= newCells.length) return s;
      [newCells[idx], newCells[targetIdx]] = [newCells[targetIdx], newCells[idx]];
      return { cells: newCells };
    });
  },

  setDatabase: (id) => set({ selectedDatabaseId: id }),
  setTitle: (title) => set({ notebookTitle: title }),

  getFilterValues: () => {
    const filters = get().cells.filter((c) => c.type === "filter" && c.filterConfig);
    const values: Record<string, unknown> = {};
    for (const cell of filters) {
      const { variable, value, type } = cell.filterConfig!;
      if (type === "date_range" && value && typeof value === "object" && "from" in value) {
        values[`${variable}_from`] = (value as { from: string; to: string }).from;
        values[`${variable}_to`] = (value as { from: string; to: string }).to;
      } else {
        values[variable] = Array.isArray(value) ? value.join(",") : value;
      }
    }
    return values;
  },

  applyFiltersToSql: (sql) => {
    const values = get().getFilterValues();
    return sql.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const val = values[key];
      return val !== undefined ? String(val) : `{{${key}}}`;
    });
  },
}));
