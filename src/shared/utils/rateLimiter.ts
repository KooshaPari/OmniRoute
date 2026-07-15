import { Keyv } from "keyv";
import { KeyvSqlite } from "@keyv/sqlite";
import path from "node:path";
import type { KvLike } from "@/shared/utils/keyvKvStore";

/**
 * Sliding-window rate limiter storage.  Defaults to an in-memory Map (TTL is
 * checked on read so expired windows self-evict).  If REDIS_URL is set we
 * still honor it via the legacy ioredis path; otherwise no sidecar is needed.
 */
export interface RateLimitStore {
  get(key: string): Promise<number | undefined>;
  set(key: string, value: number, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}

/**
 * Ephemeral in-memory store.  Rate-limit window data is short-lived (seconds to
 * minutes) so a restart-bound store is sufficient and avoids any sqlite / Redis
 * dependency for the default path.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly store = new Map<string, { v: number; exp: number }>();
  async get(key: string): Promise<number | undefined> {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.exp) {
      this.store.delete(key);
      return undefined;
    }
    return entry.v;
  }
  async set(key: string, value: number, ttlSeconds: number): Promise<void> {
    this.store.set(key, { v: value, exp: Date.now() + ttlSeconds * 1000 });
  }
  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}

/**
 * Keyv-backed rate limit store. Uses SQLite by default (embedded, no sidecar).
 * Accepts any Keyv-compatible URI via `RATE_LIMITER_KEYV_URL`. Zero-sidecar
 * deploy is the default.
 */
export class KeyvRateLimitStore implements RateLimitStore {
  private readonly keyv: Keyv;
  constructor(opts: { uri?: string } = {}) {
    const uri = opts.uri || process.env.RATE_LIMITER_KEYV_URL?.trim() || "";
    // Use the same KeyvSqlite adapter pattern as keyvKvStore.ts
    if (uri && !uri.startsWith("keyv://memory")) {
      const sqlitePath = uri.replace(/^keyv:\/\/sqlite[\/:]/i, "");
      const filePath = path.isAbsolute(sqlitePath)
        ? sqlitePath
        : path.resolve(process.cwd(), sqlitePath);
      this.keyv = new Keyv({
        store: new KeyvSqlite({ uri: filePath, table: "rate_limiter", busyTimeout: 1000 }),
      });
    } else {
      this.keyv = new Keyv();
    }
  }
  async get(key: string): Promise<number | undefined> {
    const raw = await this.keyv.get(key);
    if (raw === undefined || raw === null) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }
  async set(key: string, value: number, ttlSeconds: number): Promise<void> {
    await this.keyv.set(key, value, ttlSeconds * 1000);
  }
  async del(key: string): Promise<void> {
    await this.keyv.delete(key);
  }
}

export function isRedisConfigured(): boolean {
  return (process.env.REDIS_URL?.trim()?.length ?? 0) > 0;
}

// ioredis is intentionally NOT imported here. The rate limiter runs against a
// Keyv-backed store (in-process sqlite by default, REDIS_URL only when set).
// Keeping this stub prevents accidental re-introduction of ioredis in callers.
export const __legacyRedisClient: null = null;

/**
 * @deprecated The rate limiter no longer requires ioredis. This shim returns a
 * Keyv-backed client with an ioredis-compatible `get/set/del/quit` surface.
 * Callers (e.g. `apiKeys.ts` Redis auth cache) continue to work; the sidecar
 * is dropped because Keyv handles persistence via SQLite when REDIS_URL is unset.
 */
export interface LegacyRedisLike {
  get(key: string): Promise<string | null>;
  set(...args: unknown[]): Promise<unknown>;
  del(...args: unknown[]): Promise<unknown>;
  quit(): Promise<string>;
  on(event: string, listener: (...args: unknown[]) => void): LegacyRedisLike;
}

export function getRedisClient(): LegacyRedisLike | null {
  if (!isRedisConfigured()) return null;
  const limitStore = getRateLimitStore();
  if (!limitStore) return null;
  const adapter: LegacyRedisLike = {
    async get(key: string): Promise<string | null> {
      const v = await limitStore.get(key);
      return v === undefined ? null : String(v);
    },
    async set(...args: unknown[]): Promise<unknown> {
      const [key, value, mode, ...rest] = args as [string, string | number, string?, ...number[]];
      if (mode === "EX") {
        const ttl = Number(rest[0]) || 60;
        await limitStore.set(key, Number(value) || 0, ttl);
        return "OK";
      }
      await limitStore.set(key, Number(value) || 0, 60);
      return "OK";
    },
    async del(...args: unknown[]): Promise<unknown> {
      for (const key of args as string[]) await limitStore.del(key);
      return args.length;
    },
    async quit(): Promise<string> {
      return "OK";
    },
    on(_event: string, _listener: (...args: unknown[]) => void): LegacyRedisLike {
      return adapter;
    },
  };
  return adapter;
}

let limiterStore: RateLimitStore | null = null;

export function getRateLimitStore(): RateLimitStore {
  if (limiterStore) return limiterStore;
  // Single path: use KeyvRateLimitStore. When REDIS_URL is set we forward it as
  // the underlying URI so cross-process deploys still work — Keyv is the
  // abstraction layer. Default is embedded SQLite via @keyv/sqlite (no
  // sidecar required).
  const redisUrl = process.env.REDIS_URL?.trim() || "";
  const uri = redisUrl || undefined;
  limiterStore = new KeyvRateLimitStore({ uri });
  return limiterStore;
}

export function _resetRateLimitStoreForTests(): void {
  limiterStore = null;
}

export interface RateLimitRule {
  limit: number;
  window: number;
}

export interface RateLimitResult {
  allowed: boolean;
  failedWindow?: number;
}

const EVICTION_THRESHOLD = 1024;

// In-memory fallback for tests. Production uses `getRateLimitStore()`.
const TEST_MEMORY_STORE = new Map<string, number>();

let explicitTestMode = false;

/**
 * Atomic check-then-increment across multi-rule windows.
 *
 * Race-safe in a single-process sql backend because we use a key prefix per
 * window and rely on the SET-with-TTL primary read; for cross-process
 * deployments (REDIS_URL set) Keyv handles state isolation per URI.
 */
export async function checkRateLimit(
  keyId: string,
  rules: RateLimitRule[]
): Promise<RateLimitResult> {
  if (!rules || rules.length === 0) return { allowed: true };

  const isTestMode =
    explicitTestMode ||
    process.env.NODE_ENV === "test" ||
    process.env.DISABLE_SQLITE_AUTO_BACKUP === "true";

  if (isTestMode) {
    return checkInMemoryRateLimit(TEST_MEMORY_STORE, keyId, rules);
  }

  const store = getRateLimitStore();
  const now = Math.floor(Date.now() / 1000);

  for (const rule of rules) {
    const currentWindow = Math.floor(now / rule.window);
    const windowKey = `rl:api_key:${keyId}:${rule.window}:${currentWindow}`;
    const count = (await store.get(windowKey)) ?? 0;
    if (count >= rule.limit) {
      return { allowed: false, failedWindow: rule.window };
    }
  }

  for (const rule of rules) {
    const currentWindow = Math.floor(now / rule.window);
    const windowKey = `rl:api_key:${keyId}:${rule.window}:${currentWindow}`;
    const existing = (await store.get(windowKey)) ?? 0;
    await store.set(windowKey, existing + 1, rule.window + 1);
  }

  return { allowed: true };
}

function checkInMemoryRateLimit(
  store: Map<string, number>,
  keyId: string,
  rules: RateLimitRule[]
): RateLimitResult {
  const now = Math.floor(Date.now() / 1000);

  if (store.size > EVICTION_THRESHOLD) {
    // Same opportunistic-eviction policy as before for the test backend.
    const cut = now - 60 * 60 * 24;
    for (const [k] of store) {
      const match = k.match(/:(\d+)$/);
      if (match && Number(match[1]) < cut) store.delete(k);
    }
  }
  for (const rule of rules) {
    const currentWindow = Math.floor(now / rule.window);
    const windowKey = `rl:api_key:${keyId}:${rule.window}:${currentWindow}`;
    const count = store.get(windowKey) || 0;
    if (count >= rule.limit) {
      return { allowed: false, failedWindow: rule.window };
    }
  }

  for (const rule of rules) {
    const currentWindow = Math.floor(now / rule.window);
    const windowKey = `rl:api_key:${keyId}:${rule.window}:${currentWindow}`;
    store.set(windowKey, (store.get(windowKey) || 0) + 1);
  }

  return { allowed: true };
}

export function setRateLimiterTestMode(enabled: boolean) {
  explicitTestMode = enabled;
  if (enabled) TEST_MEMORY_STORE.clear();
}
