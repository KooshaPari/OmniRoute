// Focused verification of Bifrost streaming completion telemetry payload shaping and
// recording gating. Exercises canonical route resolution, output-token extraction,
// TTFT propagation, and generation-duration gating for non-positive TTFT values.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const {
  buildBifrostStreamOutcomePayload,
  resolveBifrostStreamRouteTarget,
} = await import("../../open-sse/handlers/chatCore/bifrostStreamOutcome.ts");
const {
  getBifrostRouteMetrics,
  resetBifrostRouteMetricsForTest,
  recordBifrostRouteOutcome,
} = await import("../../open-sse/observability/bifrostRouteMetrics.ts");

beforeEach(() => {
  resetBifrostRouteMetricsForTest();
});

test("resolveBifrostStreamRouteTarget canonicalizes provider + model for streaming outcome keys", () => {
  const target = resolveBifrostStreamRouteTarget("azure-gpt4", "gpt-4-turbo-version-2");
  assert.equal(target.provider, "azure");
  assert.equal(target.model, "gpt-4-turbo");
});

test("Bifrost streaming payload records TTFT, output tokens, and generation duration", () => {
  const target = resolveBifrostStreamRouteTarget("openai", "gpt-4o");
  const payload = buildBifrostStreamOutcomePayload({
    shouldRecord: true,
    provider: target.provider,
    model: target.model,
    connectionId: "connection-selected",
    status: 200,
    startTime: 1000,
    ttft: 120,
    streamUsage: {
      prompt_tokens: 50,
      completion_tokens: 12,
    },
    now: () => 2500,
  });

  assert.ok(payload);
  assert.equal(payload.provider, target.provider);
  assert.equal(payload.model, target.model);
  assert.equal(payload.connectionId, "connection-selected");
  assert.equal(payload.status, 200);
  assert.equal(payload.ttftMs, 120);
  assert.equal(payload.outputTokens, 12);
  assert.equal(payload.latencyMs, 1500);
  assert.equal(payload.generationDurationMs, 1380);
  recordBifrostRouteOutcome(payload);
  assert.equal(
    getBifrostRouteMetrics(target.provider, target.model, "connection-selected")?.sampleCount,
    1
  );
  assert.equal(getBifrostRouteMetrics(target.provider, target.model), null);
});

test("Bifrost streaming payload preserves the legacy metrics bucket without a connection", () => {
  const target = resolveBifrostStreamRouteTarget("openai", "gpt-4o");
  const payload = buildBifrostStreamOutcomePayload({
    shouldRecord: true,
    provider: target.provider,
    model: target.model,
    status: 200,
    startTime: 1000,
    now: () => 1500,
  });

  assert.ok(payload);
  assert.equal(payload.connectionId, undefined);
  recordBifrostRouteOutcome(payload);
  assert.equal(getBifrostRouteMetrics(target.provider, target.model)?.sampleCount, 1);
});

test("Bifrost streaming payload omits generationDuration when TTFT is not positive", () => {
  const target = resolveBifrostStreamRouteTarget("openai", "gpt-4o");
  for (const ttft of [0, -10, null]) {
    const payload = buildBifrostStreamOutcomePayload({
      shouldRecord: true,
      provider: target.provider,
      model: target.model,
      status: 200,
      startTime: 2000,
      ttft: ttft as number | null,
      streamUsage: { output_tokens: 8 },
      now: () => 2600,
    });

    assert.ok(payload);
    assert.equal(payload.ttftMs, undefined);
    assert.equal(payload.generationDurationMs, undefined);
  }
});

test("Bifrost completion recording is gated when stream outcome should not be recorded", () => {
  const target = resolveBifrostStreamRouteTarget("openai", "gpt-4o");
  const payload = buildBifrostStreamOutcomePayload({
    shouldRecord: false,
    provider: target.provider,
    model: target.model,
    status: 200,
    startTime: 1000,
    ttft: 100,
    streamUsage: { output: 15 },
    now: () => 1500,
  });

  if (payload) {
    recordBifrostRouteOutcome(payload);
  }
  const after = getBifrostRouteMetrics(target.provider, target.model);
  assert.equal(after, null);
});

test("Bifrost completion recording occurs exactly once per shouldRecord=true payload", () => {
  const target = resolveBifrostStreamRouteTarget("openai", "gpt-4o");
  const payload = buildBifrostStreamOutcomePayload({
    shouldRecord: true,
    provider: target.provider,
    model: target.model,
    status: 200,
    startTime: 1000,
    ttft: 100,
    streamUsage: { output: 15 },
    now: () => 1500,
  });

  if (payload) {
    recordBifrostRouteOutcome(payload);
  }

  const stats = getBifrostRouteMetrics(target.provider, target.model);
  assert.equal(stats?.sampleCount, 1);
});
