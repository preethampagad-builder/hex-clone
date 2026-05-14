import Anthropic from "@anthropic-ai/sdk";

export const tools: Anthropic.Tool[] = [
  {
    name: "execute_query",
    description:
      "Execute a SQL query against the connected Metabase database and return results. Use this when you need to fetch data to answer the user's question.",
    input_schema: {
      type: "object" as const,
      properties: {
        sql: {
          type: "string",
          description: "The SQL query to execute",
        },
        title: {
          type: "string",
          description: "A short human-readable title for this query (e.g. 'Revenue by Region')",
        },
        reasoning: {
          type: "string",
          description: "Brief explanation of why you're running this query",
        },
      },
      required: ["sql", "title"],
    },
  },
  {
    name: "add_filter_cell",
    description:
      "Add an interactive filter widget to the notebook. Users can change filter values and connected SQL cells will rerun automatically. Use {{variable_name}} in SQL to reference filter values.",
    input_schema: {
      type: "object" as const,
      properties: {
        label: { type: "string", description: "Display label for the filter" },
        variable: {
          type: "string",
          description: "Variable name used in SQL as {{variable_name}}",
        },
        filter_type: {
          type: "string",
          enum: ["date_range", "text", "multi_select"],
          description: "Type of filter widget",
        },
        options: {
          type: "array",
          items: { type: "string" },
          description: "Options list for multi_select filter type",
        },
      },
      required: ["label", "variable", "filter_type"],
    },
  },
  {
    name: "add_markdown_cell",
    description: "Add a markdown text cell to the notebook for explanations, headers, or context.",
    input_schema: {
      type: "object" as const,
      properties: {
        content: {
          type: "string",
          description: "Markdown content to display",
        },
      },
      required: ["content"],
    },
  },
];
