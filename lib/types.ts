export type CellType = "sql" | "result" | "chart" | "filter" | "markdown";

export type FilterType = "date_range" | "text" | "multi_select";

export type ChartType = "bar" | "line" | "area" | "pie" | "scatter";

export interface DateRange {
  from: string;
  to: string;
}

export interface FilterConfig {
  type: FilterType;
  label: string;
  variable: string;
  options?: string[]; // for multi_select
  value?: string | string[] | DateRange;
}

export interface ChartConfig {
  type: ChartType;
  xAxis?: string;
  yAxis?: string | string[];
  title?: string;
  colors?: string[];
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionMs?: number;
}

export type CellStatus = "idle" | "running" | "success" | "error";

export interface Cell {
  id: string;
  type: CellType;
  title?: string;
  // SQL cell
  sql?: string;
  // Result cell
  result?: QueryResult;
  resultCellId?: string; // id of result cell linked to this SQL cell
  chartCellId?: string;  // id of chart cell linked to this SQL cell
  sourceSqlCellId?: string; // for result/chart cells, which SQL cell they belong to
  // Chart cell
  chartConfig?: ChartConfig;
  // Filter cell
  filterConfig?: FilterConfig;
  // Markdown cell
  markdown?: string;
  // State
  status: CellStatus;
  error?: string;
  createdAt: number;
}

export interface Credentials {
  claudeApiKey: string;
  metabaseUrl: string;
  metabaseApiKey?: string;      // preferred: Metabase API key
  metabaseEmail?: string;       // fallback: username/password
  metabasePassword?: string;
  sphinxUrl: string;
  sphinxApiKey?: string;
}

export interface MetabaseDatabase {
  id: number;
  name: string;
  engine: string;
}

export interface MetabaseTable {
  id: number;
  name: string;
  display_name: string;
  schema: string;
  fields: MetabaseField[];
}

export interface MetabaseField {
  id: number;
  name: string;
  display_name: string;
  base_type: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}
