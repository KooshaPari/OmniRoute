/**
 * GET /api/compression/budget/forecast — PR-026
 *
 * Behavior under test (matches the route contract in `route.ts`):
 *   - GET with no params → defaults (horizonMs=1h, windowMs=1h, no provider filter).
 *   - GET with `?horizonMs=`, `?windowMs=`, `?provider=` → uses parsed values.
 *   - Empty compression_analytics table → 200 with all-zero forecast fields.
 *   - DB read failure → 503 with the same JSON shape (zero-filled).
 *   - Cache-Control: no-store on success responses.
 *   - Response body shape: { success, windowMs, horizonMs, p50SavedTokens,
 *     p90SavedTokens, meanSavedPerHour, sampled }.
 *
 * The route does NOT require management auth (intentional — public forecast
 * widget on the cost-guard dashboard). The test seeds rows directly into
 * `compression_analytics` and resets the singleton between tests.
 */
import test, { describe, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ─── isolated temp DB ─────────────────────────────────────────────────────────

const TEST_DATA_DIR = fs.mkdtempSync(
  path.join(os.tmpdir(), "omniroute-compression-budget-forecast-")
);
const originalDataDir = process.env.DATA_DIR;

process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../../../../../src/lib/db/core.ts");
const analytics = await import("../../../../../../src/lib/db/compressionAnalytics.ts");
const route = await import(
  "../../../../../../src/app/api/compression/budget/forecast/route.ts"
);

// ─── helpers ──────────────────────────────────────────────────────────────────

interface SeedRow {
  minutesAgo: number;
  original_tokens: number;
  compressed_tokens: number;
  tokens_saved: number;
  provider: string;
  mode?: string;
}

function clearAnalytics(): void {
  const db = core.getDbInstance();
  db.exec("DELETE FROM compression_analytics");
}

function seedRows(rows: SeedRow[]): void {
  const db = core.getDbInstance();
  const stmt = db.prepare(
    `INSERT INTO compression_analytics
       (timestamp, mode, provider, original_tokens, compressed_tokens, tokens_saved)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const r of rows) {
    const ts = new Date(Date.now() - r.minutesAgo * 60 * 1000).toISOString();
    stmt.run(ts, r.mode ?? "headroom", r.provider, r.original_tokens, r.compressed_tokens, r.tokens_saved);
  }
}

async function call(url: string): Promise<Response> {
  return route.GET(new Request(url));
}

async function callJson(url: string): Promise<{
  status: number;
  headers: Headers;
  body: Record<string, unknown>;
}> {
  const res = await call(url);
  const body = (await res.json()) as Record<string, unknown>;
  return { status: res.status, headers: res.headers, body };
}

// ─── lifecycle ────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.DATA_DIR = TEST_DATA_DIR;
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  // Touch the singleton once so the schema is created for analytics.
  core.getDbInstance();
  // Make sure the compression_analytics table exists; the analytics module's
  // helpers create the columns lazily but the base table is part of schema.
  const db = core.getDbInstance();
  db.exec(`
    CREATE TABLE IF NOT EXISTS compression_analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      combo_id TEXT,
      compression_combo_id TEXT,
      engine TEXT,
      provider TEXT,
      mode TEXT NOT NULL,
      original_tokens INTEGER NOT NULL,
      compressed_tokens INTEGER NOT NULL,
      tokens_saved INTEGER NOT NULL,
      duration_ms INTEGER,
      request_id TEXT
    )
  `);
  clearAnalytics();
});

after(() => {
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

// ─── tests ────────────────────────────────────────────────────────────────────

describe("GET /api/compression/budget/forecast — defaults & query parsing", () => {
  test("returns 200 with the documented JSON shape on empty history", async () => {
    const { status, body } = await callJson(
      "http://localhost/api/compression/budget/forecast"
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.windowMs, 60 * 60 * 1000, "default windowMs is 1 hour");
    assert.equal(body.horizonMs, 60 * 60 * 1000, "default horizonMs is 1 hour");
    assert.equal(body.sampled, 0);
    assert.equal(body.p50SavedTokens, 0);
    assert.equal(body.p90SavedTokens, 0);
    assert.equal(body.meanSavedPerHour, 0);
  });

  test("includes exactly the documented response keys", async () => {
    const { body } = await callJson(
      "http://localhost/api/compression/budget/forecast"
    );
    const expectedKeys = [
      "success",
      "windowMs",
      "horizonMs",
      "p50SavedTokens",
      "p90SavedTokens",
      "meanSavedPerHour",
      "sampled",
    ].sort();
    const actualKeys = Object.keys(body).sort();
    assert.deepEqual(actualKeys, expectedKeys);
  });

  test("applies custom horizonMs query parameter", async () => {
    const { body } = await callJson(
      "http://localhost/api/compression/budget/forecast?horizonMs=7200000"
    );
    assert.equal(body.horizonMs, 7_200_000);
    assert.equal(body.windowMs, 60 * 60 * 1000, "windowMs stays at default");
  });

  test("applies custom windowMs query parameter", async () => {
    const { body } = await callJson(
      "http://localhost/api/compression/budget/forecast?windowMs=1800000"
    );
    assert.equal(body.windowMs, 1_800_000);
    assert.equal(body.horizonMs, 60 * 60 * 1000, "horizonMs stays at default");
  });

  test("applies custom horizon and window together", async () => {
    const { body } = await callJson(
      "http://localhost/api/compression/budget/forecast?horizonMs=900000&windowMs=900000"
    );
    assert.equal(body.horizonMs, 900_000);
    assert.equal(body.windowMs, 900_000);
  });

  test("non-numeric horizonMs falls back to the default (1h)", async () => {
    const { body } = await callJson(
      "http://localhost/api/compression/budget/forecast?horizonMs=banana"
    );
    assert.equal(body.horizonMs, 60 * 60 * 1000);
  });

  test("negative horizonMs falls back to the default (1h)", async () => {
    const { body } = await callJson(
      "http://localhost/api/compression/budget/forecast?horizonMs=-5000"
    );
    assert.equal(body.horizonMs, 60 * 60 * 1000);
  });

  test("zero horizonMs falls back to the default (1h)", async () => {
    const { body } = await callJson(
      "http://localhost/api/compression/budget/forecast?horizonMs=0"
    );
    assert.equal(body.horizonMs, 60 * 60 * 1000);
  });

  test("empty horizonMs falls back to the default (1h)", async () => {
    const { body } = await callJson(
      "http://localhost/api/compression/budget/forecast?horizonMs="
    );
    assert.equal(body.horizonMs, 60 * 60 * 1000);
  });

  test("float horizonMs is floored to integer milliseconds", async () => {
    const { body } = await callJson(
      "http://localhost/api/compression/budget/forecast?horizonMs=3600000.7"
    );
    assert.equal(body.horizonMs, 3_600_000);
  });

  test("provider query parameter is accepted and does not break parsing of other params", async () => {
    const { body } = await callJson(
      "http://localhost/api/compression/budget/forecast?provider=openai"
    );
    // Provider doesn't appear in the body — it's just a filter. Make sure
    // the request still succeeds and didn't break parsing of other params.
    assert.equal(body.success, true);
    assert.equal(body.horizonMs, 60 * 60 * 1000);
    assert.equal(body.windowMs, 60 * 60 * 1000);
  });
});

describe("GET /api/compression/budget/forecast — empty history", () => {
  test("empty compression_analytics returns all zeros at sampled=0", async () => {
    const { body } = await callJson(
      "http://localhost/api/compression/budget/forecast"
    );
    assert.equal(body.success, true);
    assert.equal(body.sampled, 0);
    assert.equal(body.p50SavedTokens, 0);
    assert.equal(body.p90SavedTokens, 0);
    assert.equal(body.meanSavedPerHour, 0);
  });

  test("rows outside the windowMs are ignored (sampled=0)", async () => {
    seedRows([
      { minutesAgo: 120, original_tokens: 1000, compressed_tokens: 500, tokens_saved: 500, provider: "openai" },
    ]);
    const { body } = await callJson(
      "http://localhost/api/compression/budget/forecast?windowMs=3600000"
    );
    assert.equal(body.sampled, 0, "row outside window should not count");
    assert.equal(body.p50SavedTokens, 0);
    assert.equal(body.p90SavedTokens, 0);
    assert.equal(body.meanSavedPerHour, 0);
  });

  test("all-zero rows (zero saved AND zero tokens) are filtered out", async () => {
    // Bypass analytics.insertCompressionAnalyticsRow and write directly so we
    // can produce a row that the route's row-filter should reject.
    const db = core.getDbInstance();
    db.prepare(
      `INSERT INTO compression_analytics (timestamp, mode, provider, original_tokens, compressed_tokens, tokens_saved)
       VALUES (?, 'headroom', 'openai', 0, 0, 0)`
    ).run(new Date(Date.now() - 60 * 1000).toISOString());

    const { body } = await callJson(
      "http://localhost/api/compression/budget/forecast"
    );
    assert.equal(body.sampled, 0, "zero-row should be filtered out by readCompressionHistory");
    assert.equal(body.p50SavedTokens, 0);
    assert.equal(body.p90SavedTokens, 0);
  });
});

describe("GET /api/compression/budget/forecast — populated history", () => {
  test("constant-rate history produces positive p50 and p90 over the horizon", async () => {
    // 10 points, evenly spaced over the last hour, each saving 100 tokens.
    seedRows(
      Array.from({ length: 10 }, (_, i) => ({
        minutesAgo: i * 5 + 1, // 1, 6, 11, ..., 46 minutes ago — all inside the 1h window
        original_tokens: 1000,
        compressed_tokens: 900,
        tokens_saved: 100,
        provider: "openai",
      }))
    );

    const { status, body } = await callJson(
      "http://localhost/api/compression/budget/forecast?windowMs=3600000&horizonMs=3600000"
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.sampled, 10);
    assert.equal(typeof body.p50SavedTokens, "number");
    assert.equal(typeof body.p90SavedTokens, "number");
    assert.ok(body.p50SavedTokens > 0, "p50 should be > 0 with positive history");
    assert.ok(body.p90SavedTokens > 0, "p90 should be > 0 with positive history");
    assert.ok(
      body.p90SavedTokens >= body.p50SavedTokens,
      `p90 should be >= p50 (got p90=${body.p90SavedTokens}, p50=${body.p50SavedTokens})`
    );
  });

  test("provider filter restricts sampled history to one provider", async () => {
    seedRows([
      { minutesAgo: 5, original_tokens: 1000, compressed_tokens: 500, tokens_saved: 500, provider: "openai" },
      { minutesAgo: 10, original_tokens: 1000, compressed_tokens: 500, tokens_saved: 500, provider: "openai" },
      { minutesAgo: 15, original_tokens: 1000, compressed_tokens: 500, tokens_saved: 500, provider: "anthropic" },
      { minutesAgo: 20, original_tokens: 1000, compressed_tokens: 500, tokens_saved: 500, provider: "anthropic" },
    ]);

    const all = await callJson(
      "http://localhost/api/compression/budget/forecast"
    );
    assert.equal(all.body.sampled, 4);

    const openaiOnly = await callJson(
      "http://localhost/api/compression/budget/forecast?provider=openai"
    );
    assert.equal(openaiOnly.body.sampled, 2);

    const anthropicOnly = await callJson(
      "http://localhost/api/compression/budget/forecast?provider=anthropic"
    );
    assert.equal(anthropicOnly.body.sampled, 2);

    const unknown = await callJson(
      "http://localhost/api/compression/budget/forecast?provider=does-not-exist"
    );
    assert.equal(unknown.body.sampled, 0);
    assert.equal(unknown.body.p50SavedTokens, 0);
  });

  test("whitespace-only provider is treated as no filter", async () => {
    seedRows([
      { minutesAgo: 5, original_tokens: 1000, compressed_tokens: 500, tokens_saved: 500, provider: "openai" },
      { minutesAgo: 10, original_tokens: 1000, compressed_tokens: 500, tokens_saved: 500, provider: "anthropic" },
    ]);
    const { body } = await callJson(
      "http://localhost/api/compression/budget/forecast?provider=%20%20%20"
    );
    assert.equal(body.sampled, 2, "whitespace provider should not filter anything");
  });

  test("larger horizonMs scales the projection up for constant history", async () => {
    seedRows(
      Array.from({ length: 5 }, (_, i) => ({
        minutesAgo: i * 10 + 1,
        original_tokens: 1000,
        compressed_tokens: 500,
        tokens_saved: 500,
        provider: "openai",
      }))
    );

    const short = await callJson(
      "http://localhost/api/compression/budget/forecast?horizonMs=3600000&windowMs=3600000"
    );
    const long = await callJson(
      "http://localhost/api/compression/budget/forecast?horizonMs=7200000&windowMs=3600000"
    );
    assert.ok(
      long.body.p50SavedTokens >= short.body.p50SavedTokens - 0.01,
      `2h horizon should be >= 1h horizon (got long=${long.body.p50SavedTokens}, short=${short.body.p50SavedTokens})`
    );
  });

  test("smaller windowMs drops older rows from the sample", async () => {
    seedRows([
      { minutesAgo: 5, original_tokens: 1000, compressed_tokens: 500, tokens_saved: 500, provider: "openai" },
      { minutesAgo: 35, original_tokens: 1000, compressed_tokens: 500, tokens_saved: 500, provider: "openai" },
      { minutesAgo: 65, original_tokens: 1000, compressed_tokens: 500, tokens_saved: 500, provider: "openai" },
    ]);

    const narrow = await callJson(
      "http://localhost/api/compression/budget/forecast?windowMs=1800000"
    );
    assert.equal(narrow.body.sampled, 1, "only the row at 5 minutes should be inside 30 min window");

    const wide = await callJson(
      "http://localhost/api/compression/budget/forecast?windowMs=3600000"
    );
    assert.equal(wide.body.sampled, 2, "rows at 5 and 35 minutes should be inside 60 min window");

    const widest = await callJson(
      "http://localhost/api/compression/budget/forecast?windowMs=7200000"
    );
    assert.equal(widest.body.sampled, 3, "all three rows are inside 2h window");
  });
});

describe("GET /api/compression/budget/forecast — error handling", () => {
  test("returns 503 when the compression_analytics table is missing", async () => {
    // Drop the table to force a real SQL error from the prepare() call.
    const db = core.getDbInstance();
    db.exec("DROP TABLE compression_analytics");

    const { status, body } = await callJson(
      "http://localhost/api/compression/budget/forecast"
    );
    assert.equal(status, 503);
    assert.equal(body.success, false);
    assert.equal(body.error, "compression_history_unavailable");
    assert.equal(body.p50SavedTokens, 0);
    assert.equal(body.p90SavedTokens, 0);
    assert.equal(body.meanSavedPerHour, 0);
    assert.equal(body.sampled, 0);
  });

  test("503 response still echoes windowMs and horizonMs", async () => {
    const db = core.getDbInstance();
    db.exec("DROP TABLE compression_analytics");

    const { status, body } = await callJson(
      "http://localhost/api/compression/budget/forecast?horizonMs=1800000&windowMs=2700000"
    );
    assert.equal(status, 503);
    assert.equal(body.windowMs, 2_700_000);
    assert.equal(body.horizonMs, 1_800_000);
  });

  test("503 response includes a non-empty details string", async () => {
    const db = core.getDbInstance();
    db.exec("DROP TABLE compression_analytics");

    const { body } = await callJson(
      "http://localhost/api/compression/budget/forecast"
    );
    assert.equal(body.success, false);
    assert.equal(typeof body.details, "string");
    assert.ok(
      (body.details as string).length > 0,
      "details should be a non-empty diagnostic string"
    );
  });
});

describe("GET /api/compression/budget/forecast — response headers", () => {
  test("success responses set Cache-Control: no-store", async () => {
    const { headers } = await callJson(
      "http://localhost/api/compression/budget/forecast"
    );
    const cacheControl = headers.get("Cache-Control") ?? headers.get("cache-control");
    assert.ok(cacheControl, "Cache-Control header should be present");
    assert.ok(
      cacheControl.includes("no-store"),
      `Cache-Control should include no-store, got: ${cacheControl}`
    );
  });

  test("content-type is application/json on success", async () => {
    const res = await call("http://localhost/api/compression/budget/forecast");
    const ct = res.headers.get("Content-Type") ?? res.headers.get("content-type") ?? "";
    assert.ok(ct.includes("application/json"), `expected application/json, got ${ct}`);
  });
});

describe("GET /api/compression/budget/forecast — field types", () => {
  test("all numeric fields are numbers (not strings) on success", async () => {
    seedRows([
      { minutesAgo: 5, original_tokens: 1000, compressed_tokens: 500, tokens_saved: 500, provider: "openai" },
    ]);
    const { body } = await callJson(
      "http://localhost/api/compression/budget/forecast"
    );
    assert.equal(typeof body.windowMs, "number");
    assert.equal(typeof body.horizonMs, "number");
    assert.equal(typeof body.p50SavedTokens, "number");
    assert.equal(typeof body.p90SavedTokens, "number");
    assert.equal(typeof body.meanSavedPerHour, "number");
    assert.equal(typeof body.sampled, "number");
    assert.equal(typeof body.success, "boolean");
  });

  test("all numeric fields are finite on success", async () => {
    seedRows([
      { minutesAgo: 5, original_tokens: 1000, compressed_tokens: 500, tokens_saved: 500, provider: "openai" },
      { minutesAgo: 10, original_tokens: 1000, compressed_tokens: 500, tokens_saved: 500, provider: "openai" },
      { minutesAgo: 15, original_tokens: 1000, compressed_tokens: 500, tokens_saved: 500, provider: "openai" },
    ]);
    const { body } = await callJson(
      "http://localhost/api/compression/budget/forecast"
    );
    for (const k of ["windowMs", "horizonMs", "p50SavedTokens", "p90SavedTokens", "meanSavedPerHour", "sampled"]) {
      assert.ok(
        Number.isFinite(body[k] as number),
        `field ${k} should be finite, got ${body[k]}`
      );
    }
  });

  test("no NaN values in the success response", async () => {
    seedRows([
      { minutesAgo: 5, original_tokens: 1000, compressed_tokens: 500, tokens_saved: 500, provider: "openai" },
    ]);
    const { body } = await callJson(
      "http://localhost/api/compression/budget/forecast"
    );
    for (const k of ["p50SavedTokens", "p90SavedTokens", "meanSavedPerHour"]) {
      assert.ok(!Number.isNaN(body[k] as number), `${k} should not be NaN`);
    }
  });

  test("p90SavedTokens is always >= p50SavedTokens on success", async () => {
    seedRows([
      { minutesAgo: 5, original_tokens: 1000, compressed_tokens: 900, tokens_saved: 100, provider: "openai" },
      { minutesAgo: 10, original_tokens: 1000, compressed_tokens: 700, tokens_saved: 300, provider: "openai" },
      { minutesAgo: 15, original_tokens: 1000, compressed_tokens: 500, tokens_saved: 500, provider: "openai" },
    ]);
    const { body } = await callJson(
      "http://localhost/api/compression/budget/forecast"
    );
    assert.ok(
      (body.p90SavedTokens as number) >= (body.p50SavedTokens as number),
      `p90 must be >= p50 (p90=${body.p90SavedTokens}, p50=${body.p50SavedTokens})`
    );
  });
});

describe("GET /api/compression/budget/forecast — analytics helper integration", () => {
  test("rows inserted via insertCompressionAnalyticsRow are picked up by the route", async () => {
    analytics.insertCompressionAnalyticsRow({
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      mode: "headroom",
      provider: "openai",
      original_tokens: 1000,
      compressed_tokens: 600,
      tokens_saved: 400,
    });

    const { body } = await callJson(
      "http://localhost/api/compression/budget/forecast"
    );
    assert.equal(body.sampled, 1);
    assert.ok((body.p50SavedTokens as number) > 0);
  });

  test("forecast reflects tokens_saved magnitudes from real rows", async () => {
    // Constant-rate history saving 1000 tokens per event over 10 events.
    for (let i = 0; i < 10; i++) {
      analytics.insertCompressionAnalyticsRow({
        timestamp: new Date(Date.now() - (i * 3 + 1) * 60 * 1000).toISOString(),
        mode: "headroom",
        provider: "openai",
        original_tokens: 2000,
        compressed_tokens: 1000,
        tokens_saved: 1000,
      });
    }
    const { body } = await callJson(
      "http://localhost/api/compression/budget/forecast?windowMs=3600000&horizonMs=3600000"
    );
    assert.equal(body.sampled, 10);
    assert.ok(
      (body.meanSavedPerHour as number) > 0,
      `meanSavedPerHour should be positive, got ${body.meanSavedPerHour}`
    );
  });
});