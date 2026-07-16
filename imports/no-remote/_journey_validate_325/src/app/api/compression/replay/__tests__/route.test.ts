/**
 * TDD for GET /api/compression/replay — the recent compression run history
 * endpoint that backs the studio's "replay" panel.
 *
 * It returns compression_analytics rows (newest first), with optional
 * provider / model / windowMs query parameters plus the per-engine breakdown
 * rows for each run. See src/app/api/compression/replay/route.ts and the
 * live event shape in open-sse/services/compression/engineBreakdown.ts.
 *
 * Auth: requireManagementAuth — not enforced in the unconfigured/first-run
 * state (fresh temp DATA_DIR, no INITIAL_PASSWORD), so these exercise the
 * 200 happy path. The DB helper (getRecentCompressionAnalyticsRuns) is
 * covered separately so this file is focused on the route wiring.
 *
 * Run: node --import tsx/esm --test src/app/api/compression/replay/__tests__/route.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ─── isolated temp DB ────────────────────────────────────────────────────────

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-compression-replay-"));
const ORIGINAL_DATA_DIR = process.env.DATA_DIR;
const ORIGINAL_INITIAL_PASSWORD = process.env.INITIAL_PASSWORD;
process.env.DATA_DIR = TEST_DATA_DIR;
delete process.env.INITIAL_PASSWORD;

const core = await import("@/lib/db/core.ts");
core.resetDbInstance();

const {
  insertCompressionAnalyticsRow,
  insertCompressionEngineBreakdown,
  getRecentCompressionAnalyticsRuns,
} = await import("@/lib/db/compressionAnalytics.ts");

const route = await import("../route.ts");

// ─── helpers ─────────────────────────────────────────────────────────────────

function get(url: string): Request {
  return new Request(url, { method: "GET" });
}

function resetDb(): void {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

interface ReplayResponseBody {
  runs: Array<{
    id: number;
    timestamp: string;
    mode: string;
    engine: string | null;
    provider: string | null;
    modelHint: string | null;
    requestId: string | null;
    originalTokens: number;
    compressedTokens: number;
    tokensSaved: number;
    savingsPercent: number;
    durationMs: number | null;
    validationFallback: boolean;
    receiptSource: string | null;
    estimatedUsdSaved: number | null;
    actualTotalTokens: number | null;
    engineBreakdown: Array<{
      engine: string;
      originalTokens: number;
      compressedTokens: number;
    }>;
  }>;
  count: number;
  filters: { provider: string | null; model: string | null; windowMs: number; limit: number };
  windowStart: string;
  now: string;
}

// ─── lifecycle ───────────────────────────────────────────────────────────────

test.beforeEach(() => {
  resetDb();
});

test.after(() => {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  if (ORIGINAL_DATA_DIR === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = ORIGINAL_DATA_DIR;
  if (ORIGINAL_INITIAL_PASSWORD !== undefined)
    process.env.INITIAL_PASSWORD = ORIGINAL_INITIAL_PASSWORD;
});

// ─── tests ────────────────────────────────────────────────────────────────────

test("GET /replay — empty store returns 200 with zero runs and default filters", async () => {
  const res = await route.GET(get("http://localhost/api/compression/replay"));
  assert.equal(res.status, 200);
  const body = await readJson<ReplayResponseBody>(res);
  assert.equal(body.count, 0);
  assert.deepEqual(body.runs, []);
  assert.equal(body.filters.provider, null);
  assert.equal(body.filters.model, null);
  assert.equal(body.filters.windowMs, 24 * 60 * 60 * 1000, "default windowMs is 24h");
  assert.equal(body.filters.limit, 100, "default limit is 100");
  assert.ok(typeof body.windowStart === "string" && body.windowStart.endsWith("Z"));
  assert.ok(typeof body.now === "string" && body.now.endsWith("Z"));
});

test("GET /replay — returns runs newest first with the expected shape", async () => {
  const older = new Date(Date.now() - 60_000).toISOString();
  const newer = new Date(Date.now() - 5_000).toISOString();

  insertCompressionAnalyticsRow({
    timestamp: older,
    provider: "openai",
    mode: "stacked",
    engine: "headroom",
    original_tokens: 1000,
    compressed_tokens: 700,
    tokens_saved: 300,
    duration_ms: 12,
    request_id: "gpt-4o-mini::req-older",
    validation_fallback: 0,
    receipt_source: "provider",
    estimated_usd_saved: 0.0001,
    actual_total_tokens: 700,
  });
  insertCompressionAnalyticsRow({
    timestamp: newer,
    provider: "anthropic",
    mode: "stacked",
    engine: "caveman",
    original_tokens: 2000,
    compressed_tokens: 1100,
    tokens_saved: 900,
    duration_ms: 21,
    request_id: "claude-3-5-sonnet::req-newer",
    validation_fallback: 1,
    receipt_source: "provider",
    estimated_usd_saved: 0.0042,
    actual_total_tokens: 1100,
  });

  const res = await route.GET(get("http://localhost/api/compression/replay"));
  assert.equal(res.status, 200);
  const body = await readJson<ReplayResponseBody>(res);
  assert.equal(body.count, 2);
  assert.equal(body.runs[0].requestId, "claude-3-5-sonnet::req-newer", "newest first");
  assert.equal(body.runs[1].requestId, "gpt-4o-mini::req-older");
  assert.equal(body.runs[0].provider, "anthropic");
  assert.equal(body.runs[0].modelHint, "claude-3-5-sonnet", "modelHint extracted from request_id");
  assert.equal(body.runs[1].modelHint, "gpt-4o-mini");
  assert.equal(body.runs[0].validationFallback, true);
  assert.equal(body.runs[1].validationFallback, false);
  assert.equal(body.runs[0].savingsPercent, 45);
  assert.equal(body.runs[0].actualTotalTokens, 1100);
  assert.equal(body.runs[0].estimatedUsdSaved, 0.0042);
});

test("GET /replay — attaches per-engine breakdown rows when present", async () => {
  const now = new Date().toISOString();
  insertCompressionAnalyticsRow({
    timestamp: now,
    provider: "openai",
    mode: "stacked",
    engine: "stacked",
    original_tokens: 2000,
    compressed_tokens: 1100,
    tokens_saved: 900,
    duration_ms: 30,
    request_id: "gpt-4o::req-breakdown",
  });
  insertCompressionEngineBreakdown([
    {
      timestamp: now,
      request_id: "gpt-4o::req-breakdown",
      engine: "headroom",
      original_tokens: 2000,
      compressed_tokens: 1500,
      tokens_saved: 500,
      duration_ms: 10,
    },
    {
      timestamp: now,
      request_id: "gpt-4o::req-breakdown",
      engine: "caveman",
      original_tokens: 1500,
      compressed_tokens: 1100,
      tokens_saved: 400,
      duration_ms: 15,
    },
  ]);

  const res = await route.GET(get("http://localhost/api/compression/replay"));
  const body = await readJson<ReplayResponseBody>(res);
  assert.equal(body.count, 1);
  const breakdown = body.runs[0].engineBreakdown;
  assert.equal(breakdown.length, 2, "two breakdown rows attached");
  assert.deepEqual(
    breakdown.map((b) => b.engine),
    ["headroom", "caveman"]
  );
  assert.equal(breakdown[0].originalTokens, 2000);
  assert.equal(breakdown[1].compressedTokens, 1100);
});

test("GET /replay — synthesizes a breakdown row when none is stored", async () => {
  insertCompressionAnalyticsRow({
    timestamp: new Date().toISOString(),
    provider: "anthropic",
    mode: "lite",
    engine: "lite",
    original_tokens: 1000,
    compressed_tokens: 800,
    tokens_saved: 200,
    request_id: "claude::req-solo",
  });

  const res = await route.GET(get("http://localhost/api/compression/replay"));
  const body = await readJson<ReplayResponseBody>(res);
  assert.equal(body.runs[0].engineBreakdown.length, 1);
  assert.equal(body.runs[0].engineBreakdown[0].engine, "lite");
  assert.equal(body.runs[0].engineBreakdown[0].originalTokens, 1000);
  assert.equal(body.runs[0].engineBreakdown[0].compressedTokens, 800);
});

test("GET /replay?provider=openai — filters by case-insensitive provider", async () => {
  const now = new Date().toISOString();
  insertCompressionAnalyticsRow({
    timestamp: now,
    provider: "OpenAI",
    mode: "lite",
    original_tokens: 100,
    compressed_tokens: 60,
    tokens_saved: 40,
    request_id: "gpt::1",
  });
  insertCompressionAnalyticsRow({
    timestamp: now,
    provider: "anthropic",
    mode: "lite",
    original_tokens: 100,
    compressed_tokens: 50,
    tokens_saved: 50,
    request_id: "claude::1",
  });
  insertCompressionAnalyticsRow({
    timestamp: now,
    provider: null,
    mode: "lite",
    original_tokens: 100,
    compressed_tokens: 70,
    tokens_saved: 30,
    request_id: "unknown::1",
  });

  const res = await route.GET(
    get("http://localhost/api/compression/replay?provider=openai")
  );
  const body = await readJson<ReplayResponseBody>(res);
  assert.equal(body.count, 1, "case-insensitive match returns only the OpenAI row");
  assert.equal(body.runs[0].provider, "OpenAI");
  assert.equal(body.filters.provider, "openai");
});

test("GET /replay?model=gpt-4o — request_id LIKE filter matches nested model ids", async () => {
  const now = new Date().toISOString();
  insertCompressionAnalyticsRow({
    timestamp: now,
    provider: "openai",
    mode: "lite",
    original_tokens: 100,
    compressed_tokens: 60,
    tokens_saved: 40,
    request_id: "gpt-4o::req-1",
  });
  insertCompressionAnalyticsRow({
    timestamp: now,
    provider: "openai",
    mode: "lite",
    original_tokens: 100,
    compressed_tokens: 70,
    tokens_saved: 30,
    request_id: "gpt-4o-mini::req-2",
  });
  insertCompressionAnalyticsRow({
    timestamp: now,
    provider: "anthropic",
    mode: "lite",
    original_tokens: 100,
    compressed_tokens: 50,
    tokens_saved: 50,
    request_id: "claude::req-3",
  });

  const res = await route.GET(
    get(
      "http://localhost/api/compression/replay?model=" + encodeURIComponent("gpt-4o")
    )
  );
  const body = await readJson<ReplayResponseBody>(res);
  assert.equal(body.count, 2, "both gpt-4o and gpt-4o-mini request_ids match");
  assert.ok(body.runs.every((r) => r.requestId && r.requestId.includes("gpt-4o")));
  assert.equal(body.filters.model, "gpt-4o");
});

test("GET /replay?windowMs=60000 — only returns rows from the last minute", async () => {
  const within = new Date(Date.now() - 30_000).toISOString();
  const outside = new Date(Date.now() - 5 * 60_000).toISOString();
  insertCompressionAnalyticsRow({
    timestamp: within,
    mode: "lite",
    original_tokens: 100,
    compressed_tokens: 60,
    tokens_saved: 40,
    request_id: "within",
  });
  insertCompressionAnalyticsRow({
    timestamp: outside,
    mode: "lite",
    original_tokens: 100,
    compressed_tokens: 50,
    tokens_saved: 50,
    request_id: "outside",
  });

  const res = await route.GET(
    get("http://localhost/api/compression/replay?windowMs=60000")
  );
  const body = await readJson<ReplayResponseBody>(res);
  assert.equal(body.count, 1, "only the recent row falls in the 60s window");
  assert.equal(body.runs[0].requestId, "within");
  assert.equal(body.filters.windowMs, 60000);
  assert.ok(
    new Date(body.windowStart).getTime() <= new Date(within).getTime(),
    "windowStart is at or before the included row"
  );
});

test("GET /replay?windowMs=garbage — falls back to default 24h window", async () => {
  insertCompressionAnalyticsRow({
    timestamp: new Date(Date.now() - 60_000).toISOString(),
    mode: "lite",
    original_tokens: 100,
    compressed_tokens: 60,
    tokens_saved: 40,
    request_id: "recent",
  });
  const res = await route.GET(
    get("http://localhost/api/compression/replay?windowMs=not-a-number")
  );
  const body = await readJson<ReplayResponseBody>(res);
  assert.equal(body.filters.windowMs, 24 * 60 * 60 * 1000, "non-numeric defaults to 24h");
  assert.equal(body.count, 1);
});

test("GET /replay?windowMs=999999999999 — clamps to 30 days", async () => {
  const res = await route.GET(
    get("http://localhost/api/compression/replay?windowMs=999999999999")
  );
  const body = await readJson<ReplayResponseBody>(res);
  assert.equal(body.filters.windowMs, 30 * 24 * 60 * 60 * 1000, "clamped to 30d ceiling");
});

test("GET /replay?limit=1 — caps result count", async () => {
  const now = new Date().toISOString();
  for (let i = 0; i < 5; i++) {
    insertCompressionAnalyticsRow({
      timestamp: new Date(Date.now() - i * 1000).toISOString(),
      provider: "openai",
      mode: "lite",
      original_tokens: 100,
      compressed_tokens: 60,
      tokens_saved: 40,
      request_id: `r-${i}`,
    });
  }
  const res = await route.GET(get("http://localhost/api/compression/replay?limit=1"));
  const body = await readJson<ReplayResponseBody>(res);
  assert.equal(body.count, 1);
  assert.equal(body.runs[0].requestId, "r-0", "newest of the 5");
  assert.equal(body.filters.limit, 1);
});

test("GET /replay?limit=99999 — clamps to 1000", async () => {
  const res = await route.GET(
    get("http://localhost/api/compression/replay?limit=99999")
  );
  const body = await readJson<ReplayResponseBody>(res);
  assert.equal(body.filters.limit, 1000, "clamped to 1000 ceiling");
  assert.equal(body.count, 0, "empty store still returns a well-formed body");
});

test("GET /replay — empty query params treated as unset", async () => {
  insertCompressionAnalyticsRow({
    timestamp: new Date().toISOString(),
    mode: "lite",
    original_tokens: 100,
    compressed_tokens: 60,
    tokens_saved: 40,
    request_id: "ok",
  });
  const res = await route.GET(
    get(
      "http://localhost/api/compression/replay?provider=&model=&limit=&windowMs=&extra=junk"
    )
  );
  assert.equal(res.status, 200, "empty values are treated as no filter");
  const body = await readJson<ReplayResponseBody>(res);
  assert.equal(body.count, 1);
  assert.equal(body.filters.provider, null);
  assert.equal(body.filters.model, null);
  assert.equal(body.filters.limit, 100, "empty limit defaults to 100");
  assert.equal(body.filters.windowMs, 24 * 60 * 60 * 1000, "empty windowMs defaults to 24h");
});

test("getRecentCompressionAnalyticsRuns — respects provider + model + sinceIso together", async () => {
  const now = new Date().toISOString();
  insertCompressionAnalyticsRow({
    timestamp: now,
    provider: "openai",
    mode: "stacked",
    original_tokens: 500,
    compressed_tokens: 200,
    tokens_saved: 300,
    request_id: "gpt-4o::reqA",
  });
  insertCompressionAnalyticsRow({
    timestamp: now,
    provider: "openai",
    mode: "stacked",
    original_tokens: 500,
    compressed_tokens: 250,
    tokens_saved: 250,
    request_id: "claude::reqB",
  });

  const onlyGpt = getRecentCompressionAnalyticsRuns({
    provider: "openai",
    model: "gpt-4o",
    sinceIso: new Date(Date.now() - 60_000).toISOString(),
    limit: 50,
  });
  assert.equal(onlyGpt.length, 1);
  assert.equal(onlyGpt[0].request_id, "gpt-4o::reqA");
  assert.equal(onlyGpt[0].provider, "openai");
});
