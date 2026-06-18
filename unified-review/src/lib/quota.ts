// @ts-ignore - ioredis lacks types in this project
import { Redis } from "ioredis";
import pino from "pino";
import { Tool, ReviewQueueItem } from "./types";

const logger = pino({ name: "unified-review:quota" });

let _redis: Redis | null = null;
function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    _redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    _redis.connect().catch((e: any) => logger.warn({ err: e }, "Redis connect failed"));
    return _redis;
  } catch (e: any) {
    logger.warn({ err: e }, "Redis init failed — using in-memory");
    return null;
  }
}

const memStore = new Map<string, { used: number; resetAt: Date; degraded: boolean }>();
const memFailures = new Map<string, number[]>();
const memQueue = new Map<string, ReviewQueueItem[]>();

export interface QuotaConfig {
  tool: Tool;
  limit: number;
  window: "minute" | "hour" | "day" | "month";
  scope: "org" | "repo" | "user";
}

export interface QuotaState {
  tool: Tool;
  used: number;
  remaining: number;
  resetAt: Date;
  degraded: boolean;
  source: "redis" | "memory";
}

const DEFAULT_QUOTAS: Record<Tool, QuotaConfig> = {
  copilot: { tool: "copilot", limit: 10, window: "day", scope: "org" },
  coderabbit: { tool: "coderabbit", limit: 12, window: "day", scope: "org" },
  cursor: { tool: "cursor", limit: 8, window: "day", scope: "org" },
  forge: { tool: "forge", limit: 20, window: "day", scope: "org" },
  kilocode: { tool: "kilocode", limit: 50, window: "day", scope: "org" },
  codeql: { tool: "codeql", limit: 9999, window: "day", scope: "org" },
  "codeql-autofix": { tool: "codeql-autofix", limit: 9999, window: "day", scope: "org" },
};

export function getDefaultQuota(tool: Tool): QuotaConfig {
  return DEFAULT_QUOTAS[tool];
}

function getWindowMs(window: QuotaConfig["window"]): number {
  const m = 60_000;
  switch (window) {
    case "minute": return m;
    case "hour": return 60 * m;
    case "day": return 24 * 60 * m;
    case "month": return 30 * 24 * 60 * m;
  }
}

function key(tool: Tool, scope: string, scopeId: string): string {
  return `quota:${tool}:${scope}:${scopeId}`;
}

function ensureFresh(entry: { used: number; resetAt: Date; degraded: boolean } | undefined, config: QuotaConfig) {
  const now = new Date();
  if (!entry || now > entry.resetAt) {
    return { used: 0, resetAt: new Date(now.getTime() + getWindowMs(config.window)), degraded: false };
  }
  return entry;
}

export async function getQuotaState(tool: Tool, config: QuotaConfig, scopeId: string): Promise<QuotaState> {
  const redis = getRedis();
  if (redis?.status === "ready") {
    try {
      const k = key(tool, config.scope, scopeId);
      const [used, resetAt, degraded] = await Promise.all([
        redis.get(`${k}:used`),
        redis.get(`${k}:reset`),
        redis.get(`${k}:degraded`),
      ]);
      if (resetAt && new Date(resetAt) < new Date()) {
        await redis.del(`${k}:used`);
        await redis.del(`${k}:reset`);
        await redis.del(`${k}:degraded`);
        return { tool, used: 0, remaining: config.limit, resetAt: new Date(), degraded: false, source: "redis" };
      }
      const usedNum = parseInt(used || "0", 10);
      return {
        tool,
        used: usedNum,
        remaining: Math.max(0, config.limit - usedNum),
        resetAt: resetAt ? new Date(resetAt) : new Date(),
        degraded: degraded === "1",
        source: "redis",
      };
    } catch (err) {
      logger.warn({ err }, "Redis get failed — falling back to memory");
    }
  }
  const k = key(tool, config.scope, scopeId);
  const fresh = ensureFresh(memStore.get(k), config);
  memStore.set(k, fresh);
  return {
    tool,
    used: fresh.used,
    remaining: Math.max(0, config.limit - fresh.used),
    resetAt: fresh.resetAt,
    degraded: fresh.degraded,
    source: "memory",
  };
}

export async function consumeQuota(tool: Tool, config: QuotaConfig, scopeId: string): Promise<QuotaState> {
  const state = await getQuotaState(tool, config, scopeId);
  const redis = getRedis();
  if (redis?.status === "ready") {
    try {
      const k = key(tool, config.scope, scopeId);
      await redis.incr(`${k}:used`);
      await redis.expireat(`${k}:used`, Math.floor(state.resetAt.getTime() / 1000));
      return { ...state, used: state.used + 1, remaining: Math.max(0, config.limit - state.used - 1) };
    } catch (err) {
      logger.warn({ err }, "Redis consume failed");
    }
  }
  const k = key(tool, config.scope, scopeId);
  const fresh = ensureFresh(memStore.get(k), config);
  fresh.used += 1;
  memStore.set(k, fresh);
  return {
    tool,
    used: fresh.used,
    remaining: Math.max(0, config.limit - fresh.used),
    resetAt: fresh.resetAt,
    degraded: fresh.degraded,
    source: "memory",
  };
}

export async function markDegraded(tool: Tool, config: QuotaConfig, scopeId: string, degraded: boolean) {
  const redis = getRedis();
  if (redis?.status === "ready") {
    try {
      const k = key(tool, config.scope, scopeId);
      if (degraded) await redis.set(`${k}:degraded`, "1");
      else await redis.del(`${k}:degraded`);
      return;
    } catch (err) {
      logger.warn({ err }, "Redis markDegraded failed");
    }
  }
  const k = key(tool, config.scope, scopeId);
  const fresh = ensureFresh(memStore.get(k), config);
  fresh.degraded = degraded;
  memStore.set(k, fresh);
}

export async function recordFailure(tool: Tool, config: QuotaConfig, scopeId: string) {
  const k = `${key(tool, config.scope, scopeId)}:failures`;
  const now = Date.now();
  const redis = getRedis();
  if (redis?.status === "ready") {
    try {
      const failures = await redis.lrange(k, 0, -1);
      const recent = failures.map(Number).filter((t: number) => now - t < 5 * 60_000);
      recent.push(now);
      await redis.del(k);
      if (recent.length) await redis.rpush(k, ...recent.map(String));
      if (recent.length >= 3) {
        await markDegraded(tool, config, scopeId, true);
        setTimeout(() => markDegraded(tool, config, scopeId, false), 5 * 60_000);
      }
      return;
    } catch (err) {
      logger.warn({ err }, "Redis recordFailure failed");
    }
  }
  const arr = (memFailures.get(k) || []).filter((t) => now - t < 5 * 60_000);
  arr.push(now);
  memFailures.set(k, arr);
  if (arr.length >= 3) {
    await markDegraded(tool, config, scopeId, true);
    setTimeout(() => markDegraded(tool, config, scopeId, false), 5 * 60_000);
  }
}

/** Queue management — push work items for serial processing */
export async function enqueueReview(item: ReviewQueueItem) {
  const redis = getRedis();
  if (redis?.status === "ready") {
    try {
      const k = `queue:${item.assigned_tool}`;
      await redis.rpush(k, JSON.stringify(item));
      return;
    } catch (err) {
      logger.warn({ err }, "Redis enqueue failed");
    }
  }
  const k = `queue:${item.assigned_tool}`;
  const arr = memQueue.get(k) || [];
  arr.push(item);
  memQueue.set(k, arr);
}

export async function dequeueReview(tool: Tool): Promise<ReviewQueueItem | null> {
  const redis = getRedis();
  if (redis?.status === "ready") {
    try {
      const k = `queue:${tool}`;
      const raw = await redis.lpop(k);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      logger.warn({ err }, "Redis dequeue failed");
    }
  }
  const k = `queue:${tool}`;
  const arr = memQueue.get(k) || [];
  return arr.shift() || null;
}

export async function getQueueSize(tool: Tool): Promise<number> {
  const redis = getRedis();
  if (redis?.status === "ready") {
    try { return await redis.llen(`queue:${tool}`); }
    catch (err) { logger.warn({ err }, "Redis llen failed"); }
  }
  return (memQueue.get(`queue:${tool}`) || []).length;
}
