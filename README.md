# Hex Clone — Internal Analytics Tool

A Hex-like internal analytics notebook built with Next.js, Claude AI, Metabase, and Sphinx AI.

## Features

- **Notebook with cells** — SQL editor, result tables, auto-charts, interactive filters, markdown
- **AI chat assistant** — powered by Claude, uses Sphinx for business context and Metabase for data
- **Filter widgets** — date range, text, multi-select filters with `{{variable}}` SQL interpolation
- **Auto-visualization** — AI decides chart type (bar, line, area, pie, scatter) from query results
- **Per-user credentials** — each user enters their own API keys, stored in browser localStorage only

---

## Local setup

```bash
npm install
npm run dev
# Open http://localhost:3000
```

Enter credentials in the popup that appears on first load.

## Deploy to Vercel

Push to GitHub, then import in Vercel. No environment variables needed — credentials are user-provided via the UI. Share the Vercel URL with your team.

---

## Credentials each user needs

| Credential | Where to get it |
|---|---|
| **Claude API Key** | console.anthropic.com → API Keys |
| **Metabase URL** | Your Metabase URL e.g. `https://analytics.yourcompany.com` |
| **Metabase Email + Password** | Your Metabase login |
| **Sphinx URL** | `https://api.prod.sphinx.ai/mcp/project/<your-project-id>` |
| **Sphinx API Key** | Optional — leave blank if URL-only access works |

Credentials stay in your browser's localStorage and are never logged or sent anywhere else.

---

## Filter variables in SQL

Add a filter cell (e.g. variable `date_range`), then reference it in SQL:

```sql
WHERE created_at BETWEEN '{{date_range_from}}' AND '{{date_range_to}}'
```

Changing the filter reruns connected SQL cells automatically.

---

## Stack

Next.js 16 · Claude claude-sonnet-4-6 · Sphinx AI MCP · Metabase API · Recharts · CodeMirror 6 · Zustand · Tailwind · Vercel
