/**
 * keyvKvStore.ts — Embedded KV store adapter that mimics the ioredis surface
 * used by src/lib/quota/redisQuotaStore.ts.
 *
 * Goal: drop the Redis sidecar from the deploy matrix. Operators can opt into
 * a keyv-backed quota store (default: SQLite via @keyv/sqlite) by setting:
 *
 *     QUOTA_STORE_DRIVER=keyv
 *     QUOTA_STORE_KEYV_URL=keyv:///var/lib/omniroute/kv.sqlite
 *
 * URL schemes:
 *   keyv://memory        — in-memory Map (test/CI only, ephemeral)
 *   keyv://sqlite/<path> — @keyv/sqlite, file path
 *   keyv://sqlite?path=… — same, query form
 *
 * The exported `KvLike` interface is intentionally a structural subset of
 * `RedisLike` (incrbyfloat/expire/mget/eval/del/quit) so the existing
 * `RedisQuotaStore` can switch backends transparently.
 *
 * ioredis remains the default. Use keyv when you want a zero-sidecar deploy.
 */

import Keyv from "keyv";
import { KeyvSqlite } from "@keyv/sqlite";
import path from "node:path";

// ---------------------------------------------------------------------------
// Public interface — mirrors RedisLike in src/lib/quota/redisQuotaStore.ts
// ---------------------------------------------------------------------------

export interface KvLike {
  incrbyfloat(key: string, value: number): Promise<string>;
  expire(key: string, seconds: number): Promise<number>;
  mget(...keys: string[]): Promise<Array<string | null>>;
  /** Lua-style atomic script. Not supported on keyv; returns null with a log. */
  eval(script: string, numkeys: number, ...args: unknown[]): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  quit(): Promise<string>;
}

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

const KEYV_URL_SCHEME = "keyv:";

export type ParsedKeyvUrl =
  | { kind: "memory" }
  | { kind: "sqlite"; path: string; table?: string }
  | { kind: "memory-namespace"; namespace: string };

export function parseKeyvUrl(url: string): ParsedKeyvUrl {
  const trimmed = url.trim();
  if (!trimmed) return { kind: "memory" };

  if (!trimmed.startsWith(KEYV_URL_SCHEME)) {
    throw new Error(
      `Invalid keyv URL: ${trimmed}. Expected scheme "keyv://" (memory | sqlite[/<path>])`
    );
  }

  // keyv://memory → in-memory
  // keyv://sqlite/<path>?table=<name>
  // keyv://sqlite?path=<path>
  const KEYV_SCHEME_PREFIX = "keyv://";
  if (!trimmed.startsWith(KEYV_SCHEME_PREFIX)) {
    throw new Error(
      `Invalid keyv URL: ${trimmed}. Expected scheme "keyv://" (memory | sqlite[/<path>])`
    );
  }
  const rest = trimmed.slice(KEYV_SCHEME_PREFIX.length); // drop "keyv://"
  // Drop optional query string
  const [withoutQuery, query = ""] = rest.split("?", 2);
  const queryParams = new URLSearchParams(query);
  const tableFromQuery = queryParams.get("table") ?? undefined;
  const pathFromQuery = queryParams.get("path") ?? undefined;

  if (withoutQuery === "memory") {
    return { kind: "memory" };
  }

  if (withoutQuery === "sqlite") {
    const p = pathFromQuery ?? ":memory:";
    return { kind: "sqlite", path: path.resolve(p), table: tableFromQuery };
  }

  if (withoutQuery.startsWith("sqlite/")) {
    const p = withoutQuery.slice("sqlite/".length) || ":memory:";
    return { kind: "sqlite", path: path.resolve(p), table: tableFromQuery };
  }

  if (withoutQuery.startsWith("ns:")) {
    return { kind: "memory-namespace", namespace: withoutQuery.slice("ns:".length) };
  }

  throw new Error(
    `Unsupported keyv URL: ${trimmed}. Supported: keyv://memory, keyv://sqlite/<path>, keyv://sqlite?path=...`
  );
}

// ---------------------------------------------------------------------------
// Per-URL singleton registry (keyv clients are expensive to instantiate)
// ---------------------------------------------------------------------------

const _kvClients = new Map<string, Keyv>();

function getKeyvForUrl(parsed: ParsedKeyvUrl): Keyv {
  const cacheKey = JSON.stringify(parsed);
  const cached = _kvClients.get(cacheKey);
  if (cached) return cached;

  let client: Keyv;

  if (parsed.kind === "memory") {
    client = new Keyv();
  } else if (parsed.kind === "memory-namespace") {
    client = new Keyv({ namespace: parsed.namespace });
  } else {
    // SQLite — use @keyv/sqlite adapter.
    // We need to construct KeyvSqlite directly because the createKeyv helper
    // from @keyv/sqlite only supports a single shape (uri string) and we want
    // explicit table/busyTimeout control.
    const adapter = new KeyvSqlite({
      uri: parsed.path,
      table: parsed.table ?? "keyv",
      busyTimeout: 1000,
    });
    client = new Keyv({ store: adapter });
  }

  _kvClients.set(cacheKey, client);
  return client;
}

/** Test-only: clear all cached clients. */
export function _resetKeyvKvStoreForTests(): void {
  _kvClients.clear();
}

// ---------------------------------------------------------------------------
// Adapter — KvLike backed by Keyv
// ---------------------------------------------------------------------------

class KeyvKvStore implements KvLike {
  constructor(
    private readonly keyv: Keyv,
    private readonly parsed: ParsedKeyvUrl
  ) {}

  async incrbyfloat(key: string, value: number): Promise<string> {
    // Best-effort atomic read-modify-write. SQLite serializes writes, but
    // concurrent requests can interleave between get and set. The quota store
    // caller (RedisQuotaStore) treats incrbyfloat as advisory, not strict.
    const raw = await this.keyv.get<string>(key);
    const current = typeof raw === "string" ? parseFloat(raw) : NaN;
    const base = Number.isFinite(current) ? current : 0;
    const next = base + value;
    // Persist as string for round-trip equality with the ioredis path.
    const serialized = String(next);
    // Set with no TTL by default; the caller follows up with expire().
    await this.keyv.set(key, serialized);
    return serialized;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const raw = await this.keyv.get<string | number>(key);
    if (raw === undefined || raw === null) return 0;
    // Keyv TTL is in milliseconds.
    await this.keyv.set(key, raw, seconds * 1000);
    return 1;
  }

  async mget(...keys: string[]): Promise<Array<string | null>> {
    if (keys.length === 0) return [];
    const values = await this.keyv.getMany<string | number>(keys);
    return values.map((v) => {
      if (v === undefined || v === null) return null;
      return typeof v === "string" ? v : String(v);
    });
  }

  async eval(
    _script: string,
    _numkeys: number,
    ..._args: unknown[]
  ): Promise<unknown> {
    // Lua scripts cannot be evaluated server-side in the keyv model.
    // The only existing caller (redisQuotaStore) does not invoke eval();
    // the rate-limiter does, and that path falls through to a separate
    // adapter (see keyvRateLimiter.ts) when running on keyv.
    return null;
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const k of keys) {
      const ok = await this.keyv.delete(k);
      if (ok) count++;
    }
    return count;
  }

  async quit(): Promise<string> {
    // Best-effort close. Keyv itself doesn't expose disconnect; the SQLite
    // adapter does via its own disconnect().
    const sqliteAdapter = (this.keyv as unknown as { opts?: { store?: KeyvSqlite } })
      .opts?.store;
    if (sqliteAdapter && typeof sqliteAdapter.disconnect === "function") {
      await sqliteAdapter.disconnect();
    }
    return "OK";
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Build a KvLike backed by keyv. Throws if url is malformed.
 * Caches the underlying Keyv per (kind, path, table) tuple.
 */
export function createKvLike(url: string): KvLike {
  const parsed = parseKeyvUrl(url);
  const keyv = getKeyvForUrl(parsed);
  return new KeyvKvStore(keyv, parsed);
}

/**
 * Convenience: build an in-memory KvLike for tests and ephemeral state.
 */
export function createInMemoryKvLike(): KvLike {
  return new KeyvKvStore(new Keyv(), { kind: "memory" });
}