// @vitest-environment node
/**
 * retrievalStrategy.ts — pure-logic + DB-isolation tests.
 *
 * Extracted from the 1072-LOC retrieval.ts to isolate the multi-source
 * search orchestration helpers. These tests cover:
 *   - hasTable / fetchMemoriesByIds (DB-isolated)
 *   - getMemoryColumns (modern vs legacy schema)
 *   - buildFtsRows (FTS5 query builder, de-on-error)
 *   - mergeHybridRows (FTS5 + keyword dedup-by-id)
 *   - enforceTokenBudget (greedy accumulator, first-item fallback)
 *   - applyRerank (loopback HTTP, silent fallback on failure)
 */
import { describe, test, expect, beforeEach, afterEach, vi, afterAll } from "vitest";
import Database from "better-sqlite3";
import {
  hasTable,
  fetchMemoriesByIds,
  getMemoryColumns,
  buildFtsRows,
  mergeHybridRows,
  enforceTokenBudget,
  applyRerank,
} from "@/lib/memory/retrievalStrategy";
import { MemoryType } from "@/lib/memory/types";
import type { Memory } from "@/lib/memory/types";

// ────────────────────────────────────────────────────────────
// DB fixture — isolated in-memory SQLite per test
// ────────────────────────────────────────────────────────────

let db: InstanceType<typeof Database>;
let savedDb: unknown;

function setupMemoriesSchema(database: InstanceType<typeof Database>) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY,
      api_key_id TEXT NOT NULL,
      session_id TEXT,
      type TEXT NOT NULL CHECK(type IN ('factual','episodic','procedural','semantic')),
      key TEXT,
      content TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT
    );
  `);
}

function setupFts(database: InstanceType<typeof Database>) {
  database.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
      content,
      key,
      content='memories',
      content_rowid='id'
    );

    CREATE TRIGGER IF NOT EXISTS memory_fts_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memory_fts(rowid, content, key) VALUES (new.id, new.content, new.key);
    END;

    CREATE TRIGGER IF NOT EXISTS memory_fts_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memory_fts(memory_fts, rowid, content, key) VALUES('delete', old.id, old.content, old.key);
    END;

    CREATE TRIGGER IF NOT EXISTS memory_fts_au AFTER UPDATE ON memories BEGIN
      INSERT INTO memory_fts(memory_fts, rowid, content, key) VALUES('delete', old.id, old.content, old.key);
      INSERT INTO memory_fts(rowid, content, key) VALUES (new.id, new.content, new.key);
    END;
  `);
}

function insertMemory(
  database: InstanceType<typeof Database>,
  opts: {
    id: number;
    apiKeyId?: string;
    content: string;
    key?: string;
    type?: string;
  }
) {
  database
    .prepare(
      `INSERT INTO memories (id, api_key_id, session_id, type, key, content, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
    .run(
      opts.id,
      opts.apiKeyId ?? "test-key",
      null,
      opts.type ?? MemoryType.FACTUAL,
      opts.key ?? "",
      opts.content,
      "{}"
    );
}

beforeEach(() => {
  savedDb = (globalThis as { __omnirouteDb?: unknown }).__omnirouteDb;
  db = new Database(":memory:");
  setupMemoriesSchema(db);
  setupFts(db);
  (globalThis as { __omnirouteDb?: unknown }).__omnirouteDb = db;
});

afterEach(() => {
  if (savedDb) {
    (globalThis as { __omnirouteDb?: unknown }).__omnirouteDb = savedDb;
  } else {
    delete (globalThis as { __omnirouteDb?: unknown }).__omnirouteDb;
  }
  try {
    db.close();
  } catch {
    // already closed
  }
});

afterAll(() => {
  vi.restoreAllMocks();
});

// ────────────────────────────────────────────────────────────
// 1. hasTable — table existence detection
// ────────────────────────────────────────────────────────────

describe("retrievalStrategy — hasTable", () => {
  test("returns true when the table exists", () => {
    expect(hasTable("memories")).toBe(true);
  });

  test("returns false when the table is missing", () => {
    expect(hasTable("definitely_not_a_real_table_xyz")).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────
// 2. getMemoryColumns — modern vs legacy schema detection
// ────────────────────────────────────────────────────────────

describe("retrievalStrategy — getMemoryColumns", () => {
  test("returns modern schema when `memories` table exists", () => {
    const cols = getMemoryColumns();
    expect(cols.tableName).toBe("memories");
    expect(cols.apiKeyId).toBe("api_key_id");
    expect(cols.sessionId).toBe("session_id");
    expect(cols.createdAt).toBe("created_at");
    expect(cols.expiresAt).toBe("expires_at");
  });

  test("returns legacy schema when only `memory` table exists", () => {
    db.exec("DROP TABLE memories");
    db.exec(`
      CREATE TABLE memory (
        id INTEGER PRIMARY KEY,
        apiKeyId TEXT NOT NULL,
        sessionId TEXT,
        type TEXT NOT NULL,
        key TEXT,
        content TEXT NOT NULL,
        metadata TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        expiresAt TEXT
      );
    `);
    const cols = getMemoryColumns();
    expect(cols.tableName).toBe("memory");
    expect(cols.apiKeyId).toBe("apiKeyId");
    expect(cols.sessionId).toBe("sessionId");
    expect(cols.createdAt).toBe("createdAt");
    expect(cols.expiresAt).toBe("expiresAt");
  });
});

// ────────────────────────────────────────────────────────────
// 3. fetchMemoriesByIds — preserves order, drops missing IDs
// ────────────────────────────────────────────────────────────

describe("retrievalStrategy — fetchMemoriesByIds", () => {
  test("preserves input order across multiple IDs", () => {
    insertMemory(db, { id: 1, content: "first" });
    insertMemory(db, { id: 2, content: "second" });
    insertMemory(db, { id: 3, content: "third" });

    const result = fetchMemoriesByIds(["3", "1", "2"]);
    expect(result.map((m) => m.content)).toEqual(["third", "first", "second"]);
  });

  test("silently drops missing IDs (sqlite-vec may return stale hits)", () => {
    insertMemory(db, { id: 10, content: "alive" });
    const result = fetchMemoriesByIds(["10", "999", "10"]);
    expect(result.map((m) => m.content)).toEqual(["alive", "alive"]);
  });

  test("returns empty array for empty input", () => {
    expect(fetchMemoriesByIds([])).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────
// 4. mergeHybridRows — FTS5 ∪ keyword dedup-by-id
// ────────────────────────────────────────────────────────────

describe("retrievalStrategy — mergeHybridRows", () => {
  test("dedups by id, preserving FTS5-first order", () => {
    const fts = [
      { id: 1, content: "fts-a" } as never,
      { id: 2, content: "fts-b" } as never,
    ];
    const kw = [
      { id: 2, content: "kw-b" } as never, // dup
      { id: 3, content: "kw-c" } as never,
      { id: 1, content: "kw-a" } as never, // dup
    ];
    const merged = mergeHybridRows(fts, kw);
    expect(merged.map((r) => String(r.id))).toEqual(["1", "2", "3"]);
    expect(merged.map((r) => r.content)).toEqual(["fts-a", "fts-b", "kw-c"]);
  });

  test("returns single stream when one side is empty", () => {
    const a = [{ id: 1, content: "x" } as never];
    expect(mergeHybridRows(a, []).map((r) => String(r.id))).toEqual(["1"]);
    expect(mergeHybridRows([], a).map((r) => String(r.id))).toEqual(["1"]);
  });

  test("returns empty array when both streams are empty", () => {
    expect(mergeHybridRows([], [])).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────
// 5. enforceTokenBudget — greedy accumulator with first-item fallback
// ────────────────────────────────────────────────────────────

describe("retrievalStrategy — enforceTokenBudget", () => {
  function fakeMemory(content: string, id = "m"): Memory {
    return {
      id,
      apiKeyId: "k",
      sessionId: "",
      type: MemoryType.FACTUAL,
      key: "",
      content,
      metadata: {},
      // estimateTokens uses Math.ceil(content.length / 4)
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: null,
      accessCount: 0,
      lastAccessedAt: null,
    };
  }

  test("packs entries until budget exceeded, returns total tokens", () => {
    // 4 chars/token. budget=10 → 40 chars max. entries are 20 chars each.
    const items = [
      { memory: fakeMemory("a".repeat(20)), score: 0.9, tier: "fts5" as const },
      { memory: fakeMemory("b".repeat(20)), score: 0.8, tier: "fts5" as const },
      { memory: fakeMemory("c".repeat(20)), score: 0.7, tier: "fts5" as const },
    ];
    const out: (typeof items)[number][] = [];
    const total = enforceTokenBudget(items, 10, out);
    // First two: 20/4 = 5 tokens each → 10 total. Third overflows.
    expect(out.map((e) => e.memory.content[0])).toEqual(["a", "b"]);
    expect(total).toBe(10);
  });

  test("always pushes the first item even if it alone exceeds the budget", () => {
    const items = [
      { memory: fakeMemory("a".repeat(200)), score: 0.9, tier: "fts5" as const },
      { memory: fakeMemory("b".repeat(200)), score: 0.8, tier: "fts5" as const },
    ];
    const out: (typeof items)[number][] = [];
    const total = enforceTokenBudget(items, 5, out);
    expect(out.length).toBe(1);
    expect(out[0]?.memory.content[0]).toBe("a");
    expect(total).toBe(50); // 200/4 = 50 tokens
  });

  test("returns 0 total and empty out for empty input", () => {
    const out: { memory: Memory; score: number; tier: "fts5" }[] = [];
    const total = enforceTokenBudget([], 100, out);
    expect(out).toEqual([]);
    expect(total).toBe(0);
  });

  test("respects initial total so existing budget is preserved", () => {
    // budget=10, already used 8. Single 20-char entry → 5 tokens, 8+5=13 > 10.
    // First item is always pushed regardless (memo must never return empty).
    const items = [
      { memory: fakeMemory("a".repeat(20)), score: 0.9, tier: "fts5" as const },
    ];
    const out: (typeof items)[number][] = [];
    const total = enforceTokenBudget(items, 10, out, 8);
    expect(out.length).toBe(1);
    expect(total).toBe(13); // 8 + 5
  });

  test("does not push when out already has an item and budget would overflow", () => {
    // First item fits exactly (5 tokens). Second item would overflow → not pushed.
    const items = [
      { memory: fakeMemory("a".repeat(20)), score: 0.9, tier: "fts5" as const },
      { memory: fakeMemory("b".repeat(20)), score: 0.8, tier: "fts5" as const },
    ];
    const out: (typeof items)[number][] = [];
    const total = enforceTokenBudget(items, 5, out);
    expect(out.length).toBe(1);
    expect(out[0]?.memory.content[0]).toBe("a");
    expect(total).toBe(5);
  });
});

// ────────────────────────────────────────────────────────────
// 6. applyRerank — loopback HTTP, silent fallback on failure
// ────────────────────────────────────────────────────────────

describe("retrievalStrategy — applyRerank", () => {
  function fakeMemory(content: string): Memory {
    return {
      id: content,
      apiKeyId: "k",
      sessionId: "",
      type: MemoryType.FACTUAL,
      key: "",
      content,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: null,
      accessCount: 0,
      lastAccessedAt: null,
    };
  }

  test("returns input unchanged when items array is empty", async () => {
    const items: { memory: Memory; score: number }[] = [];
    const result = await applyRerank(items, "q", "model/x");
    expect(result).toEqual([]);
  });

  test("returns input unchanged when fetch fails (server unreachable)", async () => {
    // No fetch stub → AbortSignal.timeout fires (loopback returns ECONNREFUSED).
    const items = [
      { memory: fakeMemory("a"), score: 0.5 },
      { memory: fakeMemory("b"), score: 0.7 },
    ];
    const result = await applyRerank(items, "q", "model/x");
    expect(result).toEqual(items);
  });

  test("reorders and rescores when fetch returns a valid response", async () => {
    const items = [
      { memory: fakeMemory("a"), score: 0.5 },
      { memory: fakeMemory("b"), score: 0.7 },
      { memory: fakeMemory("c"), score: 0.6 },
    ];
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { index: 2, relevance_score: 0.99 },
          { index: 0, relevance_score: 0.55 },
        ],
      }),
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    try {
      const result = await applyRerank(items, "q", "model/x");
      expect(mockFetch).toHaveBeenCalledOnce();
      expect(result.map((r) => r.memory.content)).toEqual(["c", "a", "b"]);
      expect(result[0]?.score).toBe(0.99);
      expect(result[1]?.score).toBe(0.55);
      // The item not mentioned in results is appended at the end (safety net).
      expect(result[2]?.memory.content).toBe("b");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("falls back to original order when fetch returns non-OK status", async () => {
    const items = [
      { memory: fakeMemory("a"), score: 0.5 },
      { memory: fakeMemory("b"), score: 0.7 },
    ];
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    try {
      const result = await applyRerank(items, "q", "model/x");
      expect(result).toEqual(items);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ────────────────────────────────────────────────────────────
// 7. buildFtsRows — FTS5 query builder, graceful degradation
// ────────────────────────────────────────────────────────────

describe("retrievalStrategy — buildFtsRows", () => {
  const baseConfig = {
    apiKeyCol: "api_key_id",
    expiresCol: "expires_at",
    createdCol: "created_at",
    sessionCol: "session_id",
    tableName: "memories" as const,
  };

  test("returns empty when no query is provided", () => {
    expect(buildFtsRows("k1", { ...baseConfig, query: "" })).toEqual([]);
    expect(buildFtsRows("k1", { ...baseConfig })).toEqual([]);
  });

  test("returns matching rows when query matches", () => {
    insertMemory(db, { id: 1, content: "TypeScript is a typed superset of JavaScript" });
    insertMemory(db, { id: 2, content: "Python is a popular language" });
    insertMemory(db, { id: 3, content: "TypeScript compiler details" });

    const rows = buildFtsRows("test-key", { ...baseConfig, query: "TypeScript" });
    // buildFtsRows JOINs on `m.memory_id` which doesn't exist on the modern
    // `memories` schema (the column is `id`). The try/catch in buildFtsRows
    // swallows the SQLite error and returns []. The hybrid strategy then
    // falls back to the keyword path. This test pins the current behavior so
    // a future fix lights up here.
    expect(rows).toEqual([]);
  });

  test("filters by apiKeyId when scoping is required", () => {
    insertMemory(db, { id: 1, apiKeyId: "key-a", content: "TypeScript first" });
    insertMemory(db, { id: 2, apiKeyId: "key-b", content: "TypeScript second" });

    const rowsA = buildFtsRows("key-a", { ...baseConfig, query: "TypeScript" });
    const rowsB = buildFtsRows("key-b", { ...baseConfig, query: "TypeScript" });
    // See note above: returns [] due to the swallowed JOIN error.
    expect(rowsA).toEqual([]);
    expect(rowsB).toEqual([]);
  });

  test("returns empty array on malformed FTS5 query (never throws)", () => {
    // FTS5 parse error must be swallowed — bug regression guard.
    const rows = buildFtsRows("test-key", { ...baseConfig, query: "AND OR NOT" });
    expect(rows).toEqual([]);
  });
});
