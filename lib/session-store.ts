// In-memory session store.
// Works in local dev and on Vercel (warm instances retain state).
// If a cold-start clears the store, the user clicks "Regenerate session ID."

import { nanoid } from "./utils";

export interface SessionConfig {
  metabaseUrl: string;
  metabaseToken: string;
  metabaseAuthType: string;
  databaseId: number;
  databaseName: string;
}

export interface NotebookEvent {
  id: string;
  type: "add_cells" | "remove_cell" | "add_filter" | "add_markdown" | "schema_loaded";
  data: unknown;
  ts: number;
}

interface Session extends SessionConfig {
  events: NotebookEvent[];
  connectedAt: number;
  lastPing: number;
}

const store = new Map<string, Session>();

export function createSession(config: SessionConfig): string {
  const id = nanoid(16);
  store.set(id, { ...config, events: [], connectedAt: Date.now(), lastPing: Date.now() });
  return id;
}

export function updateSession(id: string, config: Partial<SessionConfig>) {
  const s = store.get(id);
  if (s) store.set(id, { ...s, ...config });
}

export function getSession(id: string): Session | undefined {
  return store.get(id);
}

export function pingSession(id: string) {
  const s = store.get(id);
  if (s) s.lastPing = Date.now();
}

export function pushEvent(sessionId: string, type: NotebookEvent["type"], data: unknown): boolean {
  const s = store.get(sessionId);
  if (!s) return false;
  s.events.push({ id: nanoid(), type, data, ts: Date.now() });
  return true;
}

export function drainEvents(sessionId: string): NotebookEvent[] {
  const s = store.get(sessionId);
  if (!s) return [];
  const events = [...s.events];
  s.events = [];
  s.lastPing = Date.now();
  return events;
}
