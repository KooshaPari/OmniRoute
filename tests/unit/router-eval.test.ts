import test from "node:test";
import assert from "node:assert/strict";

import {
  aggregateRouterObservations,
  compareRouterEvalRuns,
  computeParetoFrontier,
  formatRouterEvalComparison,
  formatRouterEvalReport,
  parseObservation,
  type RouterEvalComparison,
  type RouterEvalObservation,
} from "../../src/lib/routerEval/index.ts";

test("parseObservation reads mixed JSONL field names", () => {
  const parsed = parseObservation({
    sample_id: "s1",
    config_id: "cfg-a",
    expected_model: "gpt-4o",
    selected_model: "gpt-4o",
    latency_ms: 123,
    cost_usd: 0.007,
    status: 200,
  });

  assert.equal(parsed.sampleId, "s1");
  assert.equal(parsed.configId, "cfg-a");
  assert.equal(parsed.expectedModel, "gpt-4o");
  assert.equal(parsed.selectedModel, "gpt-4o");
  assert.equal(parsed.latencyMs, 123);
  assert.equal(parsed.costUsd, 0.007);
  assert.equal(parsed.success, true);
});

test("parseObservation preserves native router backend provenance fields", () => {
  const parsed = parseObservation({
    sample_id: "s-native",
    config_id: "native-router",
    expected_model: "gpt-4o",
    selected_model: "gpt-4o",
    router_backend: "native",
    provider_id: "openai",
    cooldown_applied: true,
    cooldown_reason: "provider_error_budget",
    status: 200,
  });

  assert.equal(parsed.routerBackend, "native");
  assert.equal(parsed.providerId, "openai");
  assert.equal(parsed.cooldownApplied, true);
  assert.equal(parsed.cooldownReason, "provider_error_budget");
});

test("aggregateRouterObservations computes deterministic config summaries", () => {
  const observations: RouterEvalObservation[] = [
    {
      sampleId: "a1",
      configId: "alpha",
      expectedModel: "gpt-4o",
      selectedModel: "gpt-4o",
      latencyMs: 100,
      costUsd: 1,
      success: true,
    },
    {
      sampleId: "a2",
      configId: "alpha",
      expectedModel: "claude",
      selectedModel: "gpt-4o",
      latencyMs: 200,
      costUsd: 2,
      success: false,
    },
    {
      sampleId: "b1",
      configId: "beta",
      expectedModel: "gpt-4o",
      selectedModel: "gpt-4o",
      latencyMs: 80,
      costUsd: 4,
      success: true,
    },
    {
      sampleId: "b2",
      configId: "beta",
      expectedModel: "gpt-4o",
      selectedModel: "gpt-4o",
      latencyMs: 110,
      costUsd: 5,
      success: true,
    },
  ];

  const report = aggregateRouterObservations(observations);

  assert.equal(report.totalObservations, 4);
  assert.equal(report.configs.length, 2);
  assert.equal(report.bestConfigId, "beta");
  assert.equal(report.configs[0]!.configId, "beta");
  assert.ok(report.bestAiq >= 0);
  assert.equal(report.paretoFrontier.length, 2);
  assert.equal(report.configs[0]!.successRate, 1);
});

test("pareto frontier collapses dominated configs", () => {
  const observations: RouterEvalObservation[] = [
    {
      sampleId: "x1",
      configId: "fast-n-cheap",
      expectedModel: "m1",
      selectedModel: "m1",
      latencyMs: 100,
      costUsd: 1,
      success: true,
    },
    {
      sampleId: "x2",
      configId: "slow-expensive",
      expectedModel: "m1",
      selectedModel: "m2",
      latencyMs: 500,
      costUsd: 100,
      success: true,
    },
    {
      sampleId: "x3",
      configId: "mid-balanced",
      expectedModel: "m1",
      selectedModel: "m1",
      latencyMs: 300,
      costUsd: 10,
      success: true,
    },
  ];

  const report = aggregateRouterObservations(observations);
  const frontier = computeParetoFrontier(report.configs);
  assert.equal(frontier.length, 1);
  assert.deepEqual(frontier.map((entry) => entry.configId), ["fast-n-cheap"]);
});

test("compareRouterEvalRuns reports regression signals and markdown", () => {
  const candidate = aggregateRouterObservations([
    {
      sampleId: "c1",
      configId: "cand",
      expectedModel: "m1",
      selectedModel: "m2",
      latencyMs: 200,
      costUsd: 2,
      success: true,
    },
  ]);
  const baseline = aggregateRouterObservations([
    {
      sampleId: "b1",
      configId: "base",
      expectedModel: "m1",
      selectedModel: "m1",
      latencyMs: 100,
      costUsd: 1,
      success: true,
    },
  ]);

  const comparison: RouterEvalComparison = compareRouterEvalRuns(candidate, baseline);
  assert.equal(comparison.regressed, true);
  assert.ok(comparison.aiqDelta < 0);
  const formatted = formatRouterEvalComparison(comparison);
  const report = formatRouterEvalReport(candidate);

  assert.match(formatted, /Regression Comparison/);
  assert.match(formatted, /AIQ delta/);
  assert.match(report, /Router Eval Report/);
  assert.match(report, /\| config \| samples/);
});
