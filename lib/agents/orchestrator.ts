import Anthropic from "@anthropic-ai/sdk";
import { tools } from "./tools";
import { ChartConfig, ChartType, QueryResult } from "../types";

export interface OrchestratorConfig {
  claudeApiKey: string;
  sphinxUrl: string;
  sphinxApiKey?: string;
  schemaContext: string;
  filterContext: string;
  databaseName: string;
}

export interface ToolCallResult {
  type: "execute_query";
  toolUseId: string;
  sql: string;
  title: string;
  result?: QueryResult;
  error?: string;
  chartConfig?: ChartConfig;
}

export interface FilterToolResult {
  type: "add_filter_cell";
  toolUseId: string;
  label: string;
  variable: string;
  filterType: "date_range" | "text" | "multi_select";
  options?: string[];
}

export interface MarkdownToolResult {
  type: "add_markdown_cell";
  toolUseId: string;
  content: string;
}

export type AgentEvent =
  | { event: "text_delta"; text: string }
  | { event: "tool_call"; data: ToolCallResult | FilterToolResult | MarkdownToolResult }
  | { event: "done" }
  | { event: "error"; message: string };

const SYSTEM_PROMPT = `You are an intelligent data analyst assistant for an internal analytics tool.
You have access to a SQL database via Metabase and a company knowledge base via Sphinx.

Your job:
1. Help users explore and understand their data through conversation
2. When useful, execute SQL queries to fetch data — results automatically appear as notebook cells with charts
3. Add filter widgets when users want to slice data interactively
4. Add markdown cells to explain findings or structure the notebook

Guidelines:
- Use Sphinx context (provided in schema context) to understand business terms, metrics definitions, and table meanings
- Write clean, efficient SQL — prefer CTEs for complex queries
- ALWAYS use fully-qualified table names exactly as shown in the schema (e.g. dataset.table_name for BigQuery, schema.table for Postgres). Never use bare unqualified table names — the schema context shows the correct format to use

BigQuery-specific SQL rules (apply when engine is bigquery or bigquery-cloud-sdk):
- Use backtick-quoted identifiers for column aliases with spaces: product_slug AS \`Product Name\`
- NEVER use double quotes for aliases — BigQuery treats "text" as a string literal, not an alias
- Simple one-word aliases need no quotes: COUNT(*) AS sessions
- String values in WHERE use single quotes: WHERE page_type = 'pdp'
- Date truncation: DATE_TRUNC(date_col, MONTH) — note argument order is opposite to Postgres
- Use COUNTIF(condition) instead of COUNT(CASE WHEN ... END)

- When you execute a query, the result will be shown as a table AND an auto-chart in the notebook
- Reference filter variables in SQL using {{variable_name}} syntax — e.g., WHERE date BETWEEN '{{date_from}}' AND '{{date_to}}'
- For date_range filters, use {{variable_from}} and {{variable_to}} (e.g., {{date_range_from}} and {{date_range_to}})
- Don't over-query — ask clarifying questions if the user's intent is unclear
- Explain your findings conversationally, don't just dump numbers`;

function buildVizDecision(result: QueryResult): ChartConfig {
  const { columns, rows } = result;
  if (rows.length === 0) return { type: "bar" };

  const numericCols = columns.filter((col) => {
    const sample = rows.slice(0, 5).map((r) => r[col]);
    return sample.some((v) => typeof v === "number" || (typeof v === "string" && !isNaN(Number(v))));
  });

  const categoricalCols = columns.filter((col) => !numericCols.includes(col));
  const datelikeCols = categoricalCols.filter((col) =>
    /date|time|month|year|week|day/i.test(col)
  );

  if (columns.length === 1 && numericCols.length === 1) {
    return { type: "bar", xAxis: columns[0], yAxis: columns[0], title: columns[0] };
  }

  if (columns.length === 2) {
    const [cat, num] = categoricalCols.length > 0
      ? [categoricalCols[0], numericCols[0]]
      : [columns[0], columns[1]];

    if (datelikeCols.length > 0) {
      return { type: "line", xAxis: datelikeCols[0], yAxis: num, title: `${num} over time` };
    }
    if (rows.length <= 8 && categoricalCols.length > 0) {
      return { type: "pie", xAxis: cat, yAxis: num };
    }
    return { type: "bar", xAxis: cat, yAxis: num };
  }

  if (datelikeCols.length > 0 && numericCols.length >= 1) {
    return { type: "area", xAxis: datelikeCols[0], yAxis: numericCols[0] };
  }

  if (numericCols.length >= 2) {
    return { type: "scatter", xAxis: numericCols[0], yAxis: numericCols[1] };
  }

  return { type: "bar", xAxis: categoricalCols[0] ?? columns[0], yAxis: numericCols[0] ?? columns[1] };
}

export async function* runOrchestrator(
  messages: Anthropic.MessageParam[],
  config: OrchestratorConfig,
  executeQueryFn: (sql: string) => Promise<QueryResult>
): AsyncGenerator<AgentEvent> {
  const client = new Anthropic({ apiKey: config.claudeApiKey });

  const mcpServers: Anthropic.Beta.BetaRequestMCPServerURLDefinition[] = [];
  if (config.sphinxUrl) {
    mcpServers.push({
      type: "url",
      url: config.sphinxUrl,
      name: "sphinx",
      ...(config.sphinxApiKey ? { authorization_token: config.sphinxApiKey } : {}),
    });
  }

  const systemWithContext = `${SYSTEM_PROMPT}

## Database: ${config.databaseName}
${config.schemaContext}

## Active Notebook Filters
${config.filterContext || "No filters currently defined."}`;

  try {
    // Use beta API if sphinx MCP is configured
    const requestParams = {
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemWithContext,
      messages,
      tools,
    };

    let response: Anthropic.Message;
    if (mcpServers.length > 0) {
      try {
        response = await (client.beta.messages.create as Function)({
          ...requestParams,
          mcp_servers: mcpServers,
          betas: ["mcp-client-2025-04-04"],
        });
      } catch {
        // Sphinx MCP failed — fall back to plain Claude without it
        response = await client.messages.create(requestParams);
      }
    } else {
      response = await client.messages.create(requestParams);
    }

    for (const block of response.content) {
      if (block.type === "text") {
        yield { event: "text_delta", text: block.text };
      } else if (block.type === "tool_use") {
        const input = block.input as Record<string, unknown>;

        if (block.name === "execute_query") {
          const sql = input.sql as string;
          const title = input.title as string;

          let result: QueryResult | undefined;
          let error: string | undefined;
          let chartConfig: ChartConfig | undefined;

          try {
            result = await executeQueryFn(sql);
            chartConfig = buildVizDecision(result);
          } catch (e) {
            error = e instanceof Error ? e.message : String(e);
          }

          yield {
            event: "tool_call",
            data: {
              type: "execute_query",
              toolUseId: block.id,
              sql,
              title,
              result,
              error,
              chartConfig,
            },
          };
        } else if (block.name === "add_filter_cell") {
          yield {
            event: "tool_call",
            data: {
              type: "add_filter_cell",
              toolUseId: block.id,
              label: input.label as string,
              variable: input.variable as string,
              filterType: input.filter_type as "date_range" | "text" | "multi_select",
              options: input.options as string[] | undefined,
            },
          };
        } else if (block.name === "add_markdown_cell") {
          yield {
            event: "tool_call",
            data: {
              type: "add_markdown_cell",
              toolUseId: block.id,
              content: input.content as string,
            },
          };
        }
      }
    }

    yield { event: "done" };
  } catch (e) {
    yield {
      event: "error",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
