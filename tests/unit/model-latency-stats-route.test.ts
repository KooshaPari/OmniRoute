import assert from "node:assert/strict";
import test from "node:test";

const route = await import("../../src/app/api/usage/model-latency-stats/route.ts");

const CONNECTION_ENTRY = {
  provider: "openai",
  model: "gpt-4o",
  connectionId: "primary",
  key: "openai/gpt-4o/primary",
  totalRequests: 12,
  successfulRequests: 11,
  successRate: 11 / 12,
  avgLatencyMs: 240,
  avgTtftMs: 120,
  avgTokensPerSecond: 38.5,
  p50LatencyMs: 220,
  p95LatencyMs: 390,
  p99LatencyMs: 410,
  latencyStdDev: 35,
  windowHours: 24,
};

test("validates and defaults model latency query parameters", () => {
  const parsed = route.parseModelLatencyStatsQuery(
    "http://localhost/api/usage/model-latency-stats?provider=openai&connectionId=primary"
  );

  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.windowHours, 24);
  assert.equal(parsed.data.minSamples, 1);
  assert.equal(parsed.data.maxRows, 10_000);
  assert.equal(parsed.data.keyByConnectionId, true);
  assert.equal(parsed.data.connectionId, "primary");
});

test("rejects out-of-bounds and invalid query parameters", () => {
  assert.equal(
    route.parseModelLatencyStatsQuery(
      "http://localhost/api/usage/model-latency-stats?windowHours=0"
    ).success,
    false
  );
  assert.equal(
    route.parseModelLatencyStatsQuery(
      "http://localhost/api/usage/model-latency-stats?keyByConnectionId=yes"
    ).success,
    false
  );
});

test("preserves connection-qualified TTFT, TPS, and evidence fields", async () => {
  let receivedOptions: unknown;
  const parsed = route.parseModelLatencyStatsQuery(
    "http://localhost/api/usage/model-latency-stats?windowHours=6&minSamples=2&connectionId=primary"
  );
  assert.equal(parsed.success, true);
  if (!parsed.success) return;

  const response = await route.buildModelLatencyStatsResponse(parsed.data, async (options) => {
    receivedOptions = options;
    return { [CONNECTION_ENTRY.key]: CONNECTION_ENTRY };
  });

  assert.deepEqual(receivedOptions, {
    windowHours: 6,
    minSamples: 2,
    maxRows: 10_000,
    connectionId: "primary",
    keyByConnectionId: true,
  });
  assert.equal(response.count, 1);
  assert.equal(response.entries[0].connectionId, "primary");
  assert.equal(response.entries[0].totalRequests, 12);
  assert.equal(response.entries[0].successfulRequests, 11);
  assert.equal(response.entries[0].avgTtftMs, 120);
  assert.equal(response.entries[0].avgTokensPerSecond, 38.5);
});

test("filters entries and supports aggregate mode", async () => {
  const parsed = route.parseModelLatencyStatsQuery(
    "http://localhost/api/usage/model-latency-stats?provider=openai&model=gpt-4o&keyByConnectionId=false"
  );
  assert.equal(parsed.success, true);
  if (!parsed.success) return;

  const response = await route.buildModelLatencyStatsResponse(parsed.data, async () => ({
    [`${"openai"}/${"gpt-4o"}`]: {
      ...CONNECTION_ENTRY,
      key: `${"openai"}/${"gpt-4o"}`,
      connectionId: undefined,
    },
    [`${"anthropic"}/${"claude"}`]: {
      ...CONNECTION_ENTRY,
      provider: "anthropic",
      model: `${"claude"}`,
      key: `${"anthropic"}/${"claude"}`,
      connectionId: undefined,
    },
  }));

  assert.equal(response.keyByConnectionId, false);
  assert.equal(response.count, 1);
  assert.equal(response.entries[0].key, "openai/gpt-4o");
});
