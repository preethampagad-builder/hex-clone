"use client";

import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { ChartConfig, QueryResult } from "@/lib/types";

const COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4"];

interface Props {
  result: QueryResult;
  config: ChartConfig;
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return v.toLocaleString();
  }
  return String(v);
}

export function AutoChart({ result, config }: Props) {
  const { rows } = result;
  if (!rows.length) return <p className="text-zinc-500 text-sm">No data to chart.</p>;

  const { type, xAxis, yAxis } = config;
  const yAxes = Array.isArray(yAxis) ? yAxis : yAxis ? [yAxis] : [];

  if (type === "pie") {
    const nameKey = xAxis ?? result.columns[0];
    const valueKey = yAxes[0] ?? result.columns[1];
    return (
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={rows} dataKey={valueKey} nameKey={nameKey} cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}>
            {rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v: unknown) => fmt(v)} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === "scatter") {
    const xKey = xAxis ?? result.columns[0];
    const yKey = yAxes[0] ?? result.columns[1];
    return (
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey={xKey} tick={{ fill: "#a1a1aa", fontSize: 11 }} />
          <YAxis dataKey={yKey} tick={{ fill: "#a1a1aa", fontSize: 11 }} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(v: unknown) => fmt(v)} />
          <Scatter data={rows} fill={COLORS[0]} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  const xKey = xAxis ?? result.columns[0];
  const barLines = yAxes.length ? yAxes : [result.columns.find((c) => c !== xKey) ?? result.columns[1]];

  const commonProps = {
    data: rows,
    margin: { top: 4, right: 16, left: 0, bottom: 4 },
  };
  const axisProps = {
    tick: { fill: "#a1a1aa", fontSize: 11 },
    stroke: "#3f3f46",
  };

  if (type === "line") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey={xKey} {...axisProps} />
          <YAxis {...axisProps} tickFormatter={fmt} />
          <Tooltip formatter={(v: unknown) => fmt(v)} contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} />
          <Legend />
          {barLines.map((k, i) => (
            <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} dot={false} strokeWidth={2} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === "area") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey={xKey} {...axisProps} />
          <YAxis {...axisProps} tickFormatter={fmt} />
          <Tooltip formatter={(v: unknown) => fmt(v)} contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} />
          <Legend />
          {barLines.map((k, i) => (
            <Area key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length] + "33"} strokeWidth={2} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} tickFormatter={fmt} />
        <Tooltip formatter={(v: unknown) => fmt(v)} contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} />
        <Legend />
        {barLines.map((k, i) => (
          <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
