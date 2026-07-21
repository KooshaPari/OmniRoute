import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-usage-analytics-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");
const localDb = await import("../../src/lib/localDb.ts");
const apiKeysDb = await import("../../src/lib/db/apiKeys.ts");
const providersDb = await import("../../src/lib/db/providers.ts");
const usageHistory = await import("../../src/lib/usage/usageHistory.ts");
const usageStats = await import("../../src/lib/usage/usageStats.ts");
const legacyUsageAnalytics = await import("../../src/lib/usageAnalytics.ts");
const callLogs = await import("../../src/lib/usage/callLogs.ts");
const { calculateCost, getCodexFastCostMultiplier } =
  await import("../../src/lib/usage/costCalculator.ts");

// Use the official clearPendingRequests export instead of manual cleanup
const clearPendingRequests = usageHistory.clearPendingRequests;

async function resetStorage() {
  core.resetDbInstance();
  apiKeysDb.resetApiKeyState();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  clearPendingRequests();
}

async function withPrepareFailure(match: string, fn: () => Promise<void>) {
  const db = core.getDbInstance();
  const originalPrepare = db.prepare.bind(db);

  db.prepare = (sql, ...args) => {
    if (String(sql).includes(match)) {
      throw new Error("full history scan should not run");
    }
    return originalPrepare(sql, ...args);
  };

  try {
    await fn();
  } finally {
    db.prepare = originalPrepare;
  }
}

test.beforeEach(async () => {
  await resetStorage();
});

test.after(() => {
  core.resetDbInstance();
  apiKeysDb.resetApiKeyState();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

test("usage history persists entries and supports filtering and usageDb compatibility", async () => {
  const recentTimestamp = new Date().toISOString();
  const olderTimestamp = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  await usageHistory.saveRequestUsage({
    provider: "provider-a",
    model: "model-a",
    connectionId: "conn-a",
    apiKeyId: "key-a",
    apiKeyName: "Key A",
    tokens: {
      input: 10,
      output: 5,
      cacheRead: 2,
      cacheCreation: 1,
      reasoning: 3,
    },
    status: "success",
    success: true,
    latencyMs: 120,
    timeToFirstTokenMs: 30,
    timestamp: recentTimestamp,
  });

  await usageHistory.saveRequestUsage({
    provider: "provider-b",
    model: "model-b",
    connectionId: "conn-b",
    tokens: {
      prompt_tokens: 20,
      completion_tokens: 7,
      cached_tokens: 4,
      cache_creation_input_tokens: 2,
      reasoning_tokens: 1,
    },
    status: "error",
    success: false,
    latencyMs: 400,
    errorCode: "rate_limited",
    timestamp: olderTimestamp,
  });

  const filtered = await usageHistory.getUsageHistory({
    provider: "provider-a",
    startDate: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  });
  const all = await usageHistory.getUsageDb();

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].provider, "provider-a");
  assert.equal(filtered[0].tokens.input, 10);
  assert.equal(filtered[0].tokens.output, 5);
  assert.equal(filtered[0].tokens.cacheRead, 2);
  assert.equal(filtered[0].tokens.cacheCreation, 1);
  assert.equal(filtered[0].tokens.reasoning, 3);
  assert.equal(filtered[0].timeToFirstTokenMs, 30);

  assert.equal(all.data.history.length, 2);
  assert.equal(all.data.history[0].provider, "provider-b");
  assert.equal(all.data.history[1].provider, "provider-a");
  assert.equal(all.data.history[0].success, false);
  assert.equal(all.data.history[1].success, true);
  assert.equal(all.data.history[0].timeToFirstTokenMs, 0);
});

test("saveRequestUsage does not use E2E latency as a missing TTFT fallback", async () => {
  await usageHistory.saveRequestUsage({
    provider: "ttft-provider",
    model: "ttft-model",
    success: true,
    latencyMs: 900,
    timestamp: new Date().toISOString(),
  });

  const history = await usageHistory.getUsageHistory({ provider: "ttft-provider" });
  assert.equal(history[0].latencyMs, 900);
  assert.equal(history[0].timeToFirstTokenMs, 0);
});

test("getModelLatencyStats aggregates success rate and latency percentiles", async () => {
  const now = Date.now();
  const entries = [
    { latencyMs: 100, timeToFirstTokenMs: 20, success: true },
    { latencyMs: 200, timeToFirstTokenMs: 40, success: true },
    { latencyMs: 400, timeToFirstTokenMs: 80, success: true },
    { latencyMs: 900, timeToFirstTokenMs: 0, success: false },
  ];

  for (const [index, entry] of entries.entries()) {
    await usageHistory.saveRequestUsage({
      provider: "latency-provider",
      model: "latency-model",
      success: entry.success,
      latencyMs: entry.latencyMs,
      timeToFirstTokenMs: entry.timeToFirstTokenMs,
      timestamp: new Date(now - index * 60 * 1000).toISOString(),
    });
  }

  const stats = await usageHistory.getModelLatencyStats({
    windowHours: 1,
    minSamples: 2,
    maxRows: 50,
  });

  const entry = stats["latency-provider/latency-model"];
  assert.ok(entry);
  assert.equal(entry.totalRequests, 4);
  assert.equal(entry.successfulRequests, 3);
  assert.equal(entry.successRate, 0.75);
  assert.equal(entry.avgLatencyMs, 233);
  assert.equal(entry.p50LatencyMs, 200);
  assert.equal(entry.p95LatencyMs, 400);
  assert.equal(entry.p99LatencyMs, 400);
  assert.ok(entry.latencyStdDev > 0);
  assert.equal(entry.latencySampleCount, 3);
  assert.equal(entry.avgTtftMs, 47);
  assert.equal(entry.ttftSampleCount, 3);
  assert.equal(entry.tpsSampleCount, 0);
});

test("getModelLatencyStats can return connection-qualified buckets without changing aggregate keys", async () => {
  const now = Date.now();
  for (const [connectionId, latency] of [
    ["latency-connection-a", 100],
    ["latency-connection-b", 900],
  ] as const) {
    for (let index = 0; index < 2; index++) {
      await usageHistory.saveRequestUsage({
        provider: "qualified-provider",
        model: "qualified-model",
        connectionId,
        success: true,
        latencyMs: latency,
        timestamp: new Date(now - index * 60 * 1000).toISOString(),
      });
    }
  }

  const aggregate = await usageHistory.getModelLatencyStats({ windowHours: 1, minSamples: 2 });
  const qualified = await usageHistory.getModelLatencyStats({
    windowHours: 1,
    minSamples: 2,
    keyByConnectionId: true,
  });

  assert.equal(aggregate["qualified-provider/qualified-model"].p95LatencyMs, 900);
  assert.equal(
    qualified["qualified-provider/qualified-model/latency-connection-a"].p95LatencyMs,
    100
  );
  assert.equal(
    qualified["qualified-provider/qualified-model/latency-connection-b"].p95LatencyMs,
    900
  );
  assert.equal(
    qualified["qualified-provider/qualified-model/latency-connection-a"].connectionId,
    "latency-connection-a"
  );
});

test("getModelLatencyStats omits unavailable TTFT instead of treating zero as fast", async () => {
  for (const [index, ttft] of [0, -10].entries()) {
    await usageHistory.saveRequestUsage({
      provider: "no-ttft-provider",
      model: "no-ttft-model",
      success: true,
      latencyMs: 200 + index,
      timeToFirstTokenMs: ttft,
      timestamp: new Date(Date.now() - index * 60 * 1000).toISOString(),
    });
  }

  const stats = await usageHistory.getModelLatencyStats({ windowHours: 1, minSamples: 2 });
  assert.equal("avgTtftMs" in stats["no-ttft-provider/no-ttft-model"], false);
  assert.equal(stats["no-ttft-provider/no-ttft-model"].ttftSampleCount, 0);
});

test("getModelLatencyStats derives TPS only from valid output, TTFT, and generation duration", async () => {
  const validSamples = [
    { output: 100, latency: 1_000, ttft: 200 },
    { output: 200, latency: 2_000, ttft: 500 },
  ];
  for (const [index, sample] of validSamples.entries()) {
    await usageHistory.saveRequestUsage({
      provider: "tps-provider",
      model: "tps-model",
      success: true,
      tokens: { output: sample.output },
      latencyMs: sample.latency,
      timeToFirstTokenMs: sample.ttft,
      timestamp: new Date(Date.now() - index * 60 * 1000).toISOString(),
    });
  }

  for (const [index, sample] of [
    { output: "not-a-number", latency: 1_000, ttft: 200 },
    { output: -5, latency: 1_000, ttft: 200 },
    { output: 100, latency: 1_000, ttft: 0 },
    { output: 100, latency: 200, ttft: 300 },
  ].entries()) {
    await usageHistory.saveRequestUsage({
      provider: "invalid-tps-provider",
      model: "invalid-tps-model",
      success: true,
      tokens: { output: sample.output },
      latencyMs: sample.latency,
      timeToFirstTokenMs: sample.ttft,
      timestamp: new Date(Date.now() - index * 60 * 1000).toISOString(),
    });
  }

  const stats = await usageHistory.getModelLatencyStats({ windowHours: 1, minSamples: 2 });
  assert.equal(stats["tps-provider/tps-model"].avgTokensPerSecond, 129.167);
  assert.equal("avgTokensPerSecond" in stats["invalid-tps-provider/invalid-tps-model"], false);
});

test("getModelLatencyStats falls back to all latencies when successful sample count is too small", async () => {
  await usageHistory.saveRequestUsage({
    provider: "fallback-provider",
    model: "fallback-model",
    success: true,
    latencyMs: 100,
    timestamp: new Date().toISOString(),
  });
  await usageHistory.saveRequestUsage({
    provider: "fallback-provider",
    model: "fallback-model",
    success: false,
    latencyMs: 500,
    timestamp: new Date().toISOString(),
  });

  const stats = await usageHistory.getModelLatencyStats({
    windowHours: 1,
    minSamples: 2,
  });

  const entry = stats["fallback-provider/fallback-model"];
  assert.ok(entry);
  assert.equal(entry.successRate, 0.5);
  assert.equal(entry.avgLatencyMs, 300);
  assert.equal(entry.p50LatencyMs, 500);
});

test("getUsageStats aggregates totals, buckets, pending requests, and cost breakdowns", async () => {
  await localDb.updatePricing({
    "pricing-provider": {
      "pricing-model": {
        input: 1000,
        cached: 100,
        output: 2000,
        reasoning: 3000,
        cache_creation: 1500,
      },
    },
  });

  const connection = await providersDb.createProviderConnection({
    provider: "pricing-provider",
    authType: "apikey",
    name: "Primary Account",
    apiKey: "sk-test",
  });

  const recentTokens = {
    input: 100,
    output: 50,
    cacheRead: 20,
    cacheCreation: 10,
    reasoning: 5,
  };
  const oldTokens = {
    input: 40,
    output: 10,
    cacheRead: 0,
    cacheCreation: 0,
    reasoning: 0,
  };

  await usageHistory.saveRequestUsage({
    provider: "pricing-provider",
    model: "pricing-model",
    connectionId: connection.id,
    apiKeyId: "api-key-1",
    apiKeyName: "Service Key",
    tokens: recentTokens,
    success: true,
    latencyMs: 150,
    timestamp: new Date().toISOString(),
  });
  await usageHistory.saveRequestUsage({
    provider: "pricing-provider",
    model: "pricing-model",
    connectionId: connection.id,
    apiKeyId: "api-key-1",
    apiKeyName: "Service Key",
    tokens: oldTokens,
    success: true,
    latencyMs: 80,
    timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
  });

  usageHistory.trackPendingRequest(
    "pricing-model",
    "pricing-provider",
    (connection as any).id,
    true
  );
  usageHistory.trackPendingRequest(
    "pricing-model",
    "pricing-provider" as any,
    (connection as any).id,
    true
  );
  usageHistory.trackPendingRequest(
    "pricing-model",
    "pricing-provider" as any,
    (connection as any).id,
    false
  );

  const stats = await usageStats.getUsageStats();
  const expectedCost =
    (await calculateCost("pricing-provider", "pricing-model", recentTokens)) +
    (await calculateCost("pricing-provider", "pricing-model", oldTokens));

  assert.equal(stats.totalRequests, 2);
  assert.equal(stats.totalPromptTokens, 140);
  assert.equal(stats.totalCompletionTokens, 60);
  assert.ok(Math.abs(stats.totalCost - expectedCost) < 1e-9);

  assert.equal(stats.byProvider["pricing-provider"].requests, 2);
  assert.equal(stats.byProvider["pricing-provider"].promptTokens, 140);
  assert.equal(stats.byModel["pricing-model (pricing-provider)"].requests, 2);

  const accountKey = "pricing-model (pricing-provider - Primary Account)";
  assert.equal(stats.byAccount[accountKey].requests, 2);
  assert.equal(stats.byAccount[accountKey].accountName, "Primary Account");

  assert.equal(stats.byApiKey["id:api-key-1"].requests, 2);
  assert.equal(stats.pending.byModel["pricing-model (pricing-provider)"], 1);
  assert.equal(stats.pending.byAccount[connection.id]["pricing-model (pricing-provider)"], 1);
  assert.deepEqual(stats.activeRequests, [
    {
      model: "pricing-model",
      provider: "pricing-provider",
      account: "Primary Account",
      count: 1,
    },
  ]);

  assert.equal(stats.last10Minutes.length, 10);
  const recentBucketTotal = stats.last10Minutes.reduce((sum, bucket) => sum + bucket.requests, 0);
  assert.equal(recentBucketTotal, 1);
});

test("getUsageStats avoids loading the entire usage_history table", async () => {
  await usageHistory.saveRequestUsage({
    provider: "provider-a",
    model: "model-a",
    tokens: { input: 10, output: 5 },
    success: true,
    timestamp: new Date().toISOString(),
  });

  await withPrepareFailure("SELECT * FROM usage_history ORDER BY timestamp ASC", async () => {
    const stats = await usageStats.getUsageStats();
    assert.equal(stats.totalRequests, 1);
    assert.equal(stats.totalPromptTokens, 10);
    assert.equal(stats.totalCompletionTokens, 5);
  });
});

test("getUsageStats groups renamed API key usage by stable ID", async () => {
  const db = core.getDbInstance();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO api_keys (id, name, key, machine_id, allowed_models, no_log, created_at, key_prefix)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "api-key-rename",
    "Current Name",
    "omni-test-key",
    "machine1234567890",
    "[]",
    0,
    now,
    "omni-test-ke"
  );

  await usageHistory.saveRequestUsage({
    provider: "provider-a",
    model: "model-a",
    apiKeyId: "api-key-rename",
    apiKeyName: "Original Name",
    tokens: { input: 10, output: 5 },
    success: true,
    timestamp: new Date(Date.now() - 60_000).toISOString(),
  });
  await usageHistory.saveRequestUsage({
    provider: "provider-a",
    model: "model-a",
    apiKeyId: "api-key-rename",
    apiKeyName: "Renamed Alias",
    tokens: { input: 20, output: 10 },
    success: true,
    timestamp: now,
  });

  const stats = await usageStats.getUsageStats();
  const row = stats.byApiKey["id:api-key-rename"];

  assert.ok(row);
  assert.equal(Object.keys(stats.byApiKey).length, 1);
  assert.equal(row.apiKeyId, "api-key-rename");
  assert.equal(row.apiKeyName, "Current Name");
  assert.deepEqual(row.historicalApiKeyNames?.sort(), ["Original Name", "Renamed Alias"]);
  assert.equal(row.requests, 2);
  assert.equal(row.promptTokens, 30);
  assert.equal(row.completionTokens, 15);
});

test("computeAnalytics groups renamed API key usage by stable ID", async () => {
  const analytics = await legacyUsageAnalytics.computeAnalytics(
    [
      {
        timestamp: new Date(Date.now() - 60_000).toISOString(),
        provider: "provider-a",
        model: "model-a",
        apiKeyId: "api-key-legacy",
        apiKeyName: "Original Name",
        tokens: { input: 10, output: 5 },
      },
      {
        timestamp: new Date().toISOString(),
        provider: "provider-a",
        model: "model-a",
        apiKeyId: "api-key-legacy",
        apiKeyName: "Renamed Alias",
        tokens: { input: 20, output: 10 },
      },
    ],
    "all"
  );

  assert.equal(analytics.summary.uniqueApiKeys, 1);
  assert.equal(analytics.byApiKey.length, 1);
  assert.equal(analytics.byApiKey[0].apiKeyId, "api-key-legacy");
  assert.deepEqual(analytics.byApiKey[0].historicalApiKeyNames.sort(), [
    "Original Name",
    "Renamed Alias",
  ]);
  assert.equal(analytics.byApiKey[0].requests, 2);
  assert.equal(analytics.byApiKey[0].promptTokens, 30);
  assert.equal(analytics.byApiKey[0].completionTokens, 15);
});

test("Codex Fast service tier applies GPT-5.5 and GPT-5.6 credit multipliers", async () => {
  await localDb.updatePricing({
    codex: {
      "gpt-5.5": { input: 5, output: 30 },
      "gpt-5.6-sol": { input: 5, output: 30 },
    },
  });

  const tokens = { input: 1000, output: 500 };

  assert.equal(await calculateCost("codex", "gpt-5.5", tokens), 0.02);
  assert.equal(await calculateCost("codex", "gpt-5.5", tokens, { serviceTier: "priority" }), 0.05);
  assert.equal(await calculateCost("codex", "gpt-5.5", tokens, { serviceTier: "flex" }), 0.01);
  assert.equal(
    await calculateCost("codex", "gpt-5.6-sol-high", tokens, { serviceTier: "fast" }),
    0.03
  );
  assert.equal(getCodexFastCostMultiplier("cx", "gpt-5.6-terra-ultra", "fast"), 1.5);
  assert.equal(getCodexFastCostMultiplier("codex", "gpt-5.6-luna-max", "priority"), 1.5);
  assert.equal(await calculateCost("openai", "gpt-5.5", tokens, { serviceTier: "priority" }), 0.02);
  assert.equal(await calculateCost("openai", "gpt-5.5", tokens, { serviceTier: "flex" }), 0.02);
});

test("recent request summaries are generated from SQLite call logs", async () => {
  const connection = await providersDb.createProviderConnection({
    provider: "log-provider",
    authType: "apikey",
    name: "Named Account",
    apiKey: "sk-test",
  });

  for (let i = 0; i < 205; i++) {
    await callLogs.saveCallLog({
      id: `log-${i}`,
      timestamp: new Date(Date.now() + i).toISOString(),
      method: "POST",
      path: "/v1/chat/completions",
      status: 200,
      model: `model-${i}`,
      provider: "log-provider",
      connectionId: connection.id,
      tokens: { input: i + 1, output: i + 2 },
      requestBody: { index: i },
      responseBody: { ok: true, index: i },
    });
  }

  const recent = await usageHistory.getRecentLogs(3);

  assert.equal(recent.length, 3);
  assert.match(recent[0], /model-204/);
  assert.match(recent[0], /LOG-PROVIDER/);
  assert.match(recent[0], /Named Account/);
  assert.match(recent[0], /205 \| 206 \| 200$/);
});

test("pending request metadata stores sanitized payload previews and clears after completion", async () => {
  usageHistory.trackPendingRequest("gpt-test", "openai", "conn-preview", true, {
    clientEndpoint: "/v1/chat/completions",
    clientRequest: {
      token: "super-secret-token",
      messages: [{ role: "user", content: "hello" }],
    },
    stage: "registered",
  });

  usageHistory.updatePendingRequest("gpt-test", "openai", "conn-preview", {
    providerUrl: "https://api.example.com/v1/chat/completions",
    providerRequest: {
      authorization: "Bearer super-secret-token",
      messages: [{ role: "user", content: "hello" }],
    },
    stage: "sending_to_provider",
  });

  const pending = usageHistory.getPendingRequests();
  const detailArr = pending.details["conn-preview"]["gpt-test (openai)"];
  const detail = detailArr[0];
  const clientRequestPreview = detail.clientRequest as Record<string, unknown>;
  const providerRequestPreview = detail.providerRequest as Record<string, unknown>;

  assert.equal(detail.clientEndpoint, "/v1/chat/completions");
  assert.equal(clientRequestPreview.token, "[REDACTED]");
  assert.equal(providerRequestPreview.authorization, "[REDACTED]");
  assert.equal(detail.providerUrl, "https://api.example.com/v1/chat/completions");
  assert.equal(detail.stage, "sending_to_provider");
  assert.equal(typeof detail.stageUpdatedAt, "number");

  usageHistory.trackPendingRequest("gpt-test", "openai", "conn-preview", false);
  assert.equal(pending.details["conn-preview"], undefined);
});

test("clearPendingRequests resets all pending counts and details", () => {
  // Simulate leaked pending counts (increment without matching decrement)
  usageHistory.trackPendingRequest("model-a", "provider-x", "conn-1", true);
  usageHistory.trackPendingRequest("model-a", "provider-x", "conn-1", true);
  usageHistory.trackPendingRequest("model-b", "provider-y", "conn-2", true);

  const before = usageHistory.getPendingRequests();
  assert.equal(before.byModel["model-a (provider-x)"], 2);
  assert.equal(before.byModel["model-b (provider-y)"], 1);
  assert.ok(before.details["conn-1"]);
  assert.ok(before.details["conn-2"]);

  // Clear all pending
  usageHistory.clearPendingRequests();

  const after = usageHistory.getPendingRequests();
  assert.equal(Object.keys(after.byModel).length, 0);
  assert.equal(Object.keys(after.byAccount).length, 0);
  assert.equal(Object.keys(after.details).length, 0);
});

test("clearPendingRequests allows fresh tracking after clearing", () => {
  usageHistory.trackPendingRequest("model-c", "provider-z", "conn-3", true);
  usageHistory.clearPendingRequests();

  // Tracking should work normally after clearing
  usageHistory.trackPendingRequest("model-d", "provider-w", "conn-4", true);
  const pending = usageHistory.getPendingRequests();
  assert.equal(pending.byModel["model-d (provider-w)"], 1);
  assert.ok(pending.details["conn-4"]);
});
