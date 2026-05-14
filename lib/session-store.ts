/**
 * Session store: Upstash Redis in production, in-memory in local dev.
 * Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN in Vercel env vars.
 * Free tier at upstash.com — no credit card needed.
 */

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

const SESSION_TTL = 60 * 60 * 4; // 4 hours
const useRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

// ── Local fallback ────────────────────────────────────────────────────────────
const localStore = new Map<string, Session>();

// ── Redis helpers ─────────────────────────────────────────────────────────────
async function redisGet(key: string): Promise<Session | null> {
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  return redis.get<Session>(key);
}

async function redisSet(key: string, value: Session): Promise<void> {
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  await redis.set(key, value, { ex: SESSION_TTL });
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function createSession(config: SessionConfig): Promise<string> {
  const id = nanoid(16);
  const session: Session = { ...config, events: [], connectedAt: Date.now(), lastPing: Date.now() };
  if (useRedis) await redisSet(id, session);
  else localStore.set(id, session);
  return id;
}

export async function updateSession(id: string, config: Partial<SessionConfig>): Promise<void> {
  const s = await getSession(id);
  if (!s) return;
  const updated = { ...s, ...config };
  if (useRedis) await redisSet(id, updated);
  else localStore.set(id, updated);
}

export async function getSession(id: string): Promise<Session | null> {
  if (useRedis) return redisGet(id);
  return localStore.get(id) ?? null;
}

export async function pingSession(id: string): Promise<void> {
  const s = await getSession(id);
  if (!s) return;
  s.lastPing = Date.now();
  if (useRedis) await redisSet(id, s);
  else localStore.set(id, s);
}

export async function pushEvent(sessionId: string, type: NotebookEvent["type"], data: unknown): Promise<boolean> {
  const s = await getSession(sessionId);
  if (!s) return false;
  s.events.push({ id: nanoid(), type, data, ts: Date.now() });
  if (useRedis) await redisSet(sessionId, s);
  else localStore.set(sessionId, s);
  return true;
}

export async function drainEvents(sessionId: string): Promise<NotebookEvent[]> {
  const s = await getSession(sessionId);
  if (!s) return [];
  const events = [...s.events];
  s.events = [];
  s.lastPing = Date.now();
  if (useRedis) await redisSet(sessionId, s);
  else localStore.set(sessionId, s);
  return events;
}
