import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmpDir = mkdtempSync(join(tmpdir(), "omniroute-test-"));
process.env.DATA_DIR = tmpDir;

const core = await import("../../../src/lib/db/core.ts");
core.resetDbInstance();
const { insertCompressionAnalyticsRow, getCompressionAnalyticsSummary } =
  await import("../../../src/lib/db/compressionAnalytics.ts");
const { getDbInstance } = core;

describe("compressionAnalytics", () => {
  before(() => {
    const db = getDbInstance();
    db.exec(`
      CREATE TABLE IF NOT EXISTS compression_analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        combo_id TEXT,
        provider TEXT,
        mode TEXT NOT NULL,
        original_tokens INTEGER NOT NULL,
        compressed_tokens INTEGER NOT NULL,
        tokens_saved INTEGER NOT NULL,
        duration_ms INTEGER,
        request_id TEXT
      )
    `);
  });

  beforeEach(() => {
    // Clear table before each test for full isolation
    const db = getDbInstance();
    db.exec("DELETE FROM compression_analytics");
  });

  after(() => {
    core.closeDbInstance();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("empty table returns zeroed summary", () => {
    const summary = getCompressionAnalyticsSummary();
    assert.deepEqual(summary, {
      totalRequests: 0,
      totalTokensSaved: 0,
      avgSavingsPct: 0,
      avgDurationMs: 0,
      byMode: {},
      byProvider: {},
      last24h: [],
    });
  });

  it("insert single row does not throw", () => {
    const row = {
      timestamp: new Date().toISOString(),
      mode: "lite",
      original_tokens: 1000,
      compressed_tokens: 800,
      tokens_saved: 200,
    };
    assert.doesNotThrow(() => insertCompressionAnalyticsRow(row));
    const summary = getCompressionAnalyticsSummary();
    assert.equal(summary.totalRequests, 1);
  });

  it("summary counts correctly after multiple inserts", () => {
    insertCompressionAnalyticsRow({
      timestamp: new Date().toISOString(),
      mode: "lite",
      original_tokens: 1000,
      compressed_tokens: 800,
      tokens_saved: 200,
    });
    insertCompressionAnalyticsRow({
      timestamp: new Date().toISOString(),
      mode: "standard",
      original_tokens: 300,
      compressed_tokens: 280,
      tokens_saved: 20,
    });
    insertCompressionAnalyticsRow({
      timestamp: new Date().toISOString(),
      mode: "aggressive",
      original_tokens: 500,
      compressed_tokens: 400,
      tokens_saved: 100,
    });
    const summary = getCompressionAnalyticsSummary();
    assert.equal(summary.totalRequests, 3);
  });

  it("totalTokensSaved sums correctly", () => {
    insertCompressionAnalyticsRow({
      timestamp: new Date().toISOString(),
      mode: "lite",
      original_tokens: 1000,
      compressed_tokens: 800,
      tokens_saved: 200,
    });
    insertCompressionAnalyticsRow({
      timestamp: new Date().toISOString(),
      mode: "standard",
      original_tokens: 300,
      compressed_tokens: 280,
      tokens_saved: 20,
    });
    const summary = getCompressionAnalyticsSummary();
    assert.equal(summary.totalTokensSaved, 220);
  });

  it("byMode groups correctly", () => {
    insertCompressionAnalyticsRow({
      timestamp: new Date().toISOString(),
      mode: "lite",
      original_tokens: 1000,
      compressed_tokens: 800,
      tokens_saved: 200,
    });
    insertCompressionAnalyticsRow({
      timestamp: new Date().toISOString(),
      mode: "lite",
      original_tokens: 500,
      compressed_tokens: 400,
      tokens_saved: 100,
    });
    insertCompressionAnalyticsRow({
      timestamp: new Date().toISOString(),
      mode: "standard",
      original_tokens: 300,
      compressed_tokens: 270,
      tokens_saved: 30,
    });
    const summary = getCompressionAnalyticsSummary();
    assert.equal(summary.byMode["lite"].count, 2);
    assert.equal(summary.byMode["lite"].tokensSaved, 300);
    assert.equal(summary.byMode["standard"].count, 1);
  });

  it("byProvider groups correctly", () => {
    insertCompressionAnalyticsRow({
      timestamp: new Date().toISOString(),
      mode: "lite",
      original_tokens: 1000,
      compressed_tokens: 800,
      tokens_saved: 200,
      provider: "ProviderA",
    });
    insertCompressionAnalyticsRow({
      timestamp: new Date().toISOString(),
      mode: "lite",
      original_tokens: 500,
      compressed_tokens: 400,
      tokens_saved: 100,
      provider: "ProviderB",
    });
    const summary = getCompressionAnalyticsSummary();
    assert.deepEqual(summary.byProvider["ProviderA"], { count: 1, tokensSaved: 200 });
    assert.deepEqual(summary.byProvider["ProviderB"], { count: 1, tokensSaved: 100 });
  });

  it("since=24h filters rows older than 24h", () => {
    const oldTimestamp = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const recentTimestamp = new Date().toISOString();

    insertCompressionAnalyticsRow({
      timestamp: oldTimestamp,
      mode: "lite",
      original_tokens: 2000,
      compressed_tokens: 1800,
      tokens_saved: 200,
    });
    insertCompressionAnalyticsRow({
      timestamp: recentTimestamp,
      mode: "lite",
      original_tokens: 1000,
      compressed_tokens: 900,
      tokens_saved: 100,
    });

    const summary24h = getCompressionAnalyticsSummary("24h");
    assert.equal(summary24h.totalRequests, 1);
    assert.equal(summary24h.totalTokensSaved, 100);
  });

  it("since=undefined returns all rows including old ones", () => {
    const oldTimestamp = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const recentTimestamp = new Date().toISOString();

    insertCompressionAnalyticsRow({
      timestamp: oldTimestamp,
      mode: "lite",
      original_tokens: 2000,
      compressed_tokens: 1800,
      tokens_saved: 200,
    });
    insertCompressionAnalyticsRow({
      timestamp: recentTimestamp,
      mode: "lite",
      original_tokens: 1000,
      compressed_tokens: 900,
      tokens_saved: 100,
    });

    const summaryAll = getCompressionAnalyticsSummary();
    assert.equal(summaryAll.totalRequests, 2);
    assert.equal(summaryAll.totalTokensSaved, 300);
  });

  it("avgSavingsPct calculates correctly", () => {
    // 200/1000 = 20%, 100/500 = 20% → avg = 20%
    insertCompressionAnalyticsRow({
      timestamp: new Date().toISOString(),
      mode: "lite",
      original_tokens: 1000,
      compressed_tokens: 800,
      tokens_saved: 200,
    });
    insertCompressionAnalyticsRow({
      timestamp: new Date().toISOString(),
      mode: "standard",
      original_tokens: 500,
      compressed_tokens: 400,
      tokens_saved: 100,
    });
    const summary = getCompressionAnalyticsSummary();
    assert.equal(summary.avgSavingsPct, 20);
  });

  it("last24h hourly buckets have correct shape", () => {
    insertCompressionAnalyticsRow({
      timestamp: new Date().toISOString(),
      mode: "lite",
      original_tokens: 1000,
      compressed_tokens: 800,
      tokens_saved: 200,
    });
    const hourly = getCompressionAnalyticsSummary("24h").last24h;
    assert(Array.isArray(hourly));
    assert(hourly.length <= 24);
    hourly.forEach((bucket) => {
      assert(typeof bucket.hour === "string");
      assert(typeof bucket.count === "number");
      assert(typeof bucket.tokensSaved === "number");
    });
  });
});
