import { MetabaseDatabase, MetabaseTable, QueryResult } from "./types";

export class MetabaseClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async authenticate(email: string, password: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: email, password }),
    });
    if (!res.ok) throw new Error(`Metabase auth failed: ${res.status}`);
    const data = await res.json();
    this.token = data.id;
    return data.id;
  }

  setToken(token: string) {
    this.token = token;
  }

  private headers() {
    return {
      "Content-Type": "application/json",
      "X-Metabase-Session": this.token ?? "",
    };
  }

  async listDatabases(): Promise<MetabaseDatabase[]> {
    const res = await fetch(`${this.baseUrl}/api/database`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Failed to list databases: ${res.status}`);
    const data = await res.json();
    return data.data ?? data;
  }

  async getDatabaseSchema(databaseId: number): Promise<MetabaseTable[]> {
    const res = await fetch(
      `${this.baseUrl}/api/database/${databaseId}/metadata?include_hidden=false`,
      { headers: this.headers() }
    );
    if (!res.ok) throw new Error(`Failed to get schema: ${res.status}`);
    const data = await res.json();
    return data.tables ?? [];
  }

  async executeQuery(databaseId: number, sql: string): Promise<QueryResult> {
    const start = Date.now();
    const res = await fetch(`${this.baseUrl}/api/dataset`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        database: databaseId,
        type: "native",
        native: { query: sql },
      }),
    });
    if (!res.ok) throw new Error(`Query failed: ${res.status}`);
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    const cols = data.data?.cols ?? [];
    const rows = data.data?.rows ?? [];

    const columns = cols.map((c: { name: string }) => c.name);
    const mappedRows = rows.map((row: unknown[]) =>
      Object.fromEntries(columns.map((col: string, i: number) => [col, row[i]]))
    );

    return {
      columns,
      rows: mappedRows,
      rowCount: mappedRows.length,
      executionMs: Date.now() - start,
    };
  }
}
