import test from "node:test";
import assert from "node:assert/strict";

import { Categorizer } from "../../src/domain/assessment/categorizer.ts";
import type { ModelAssessment } from "../../src/domain/assessment/types.ts";

function buildAssessment(overrides: Partial<ModelAssessment>): ModelAssessment {
  return {
    id: "prov/model",
    modelId: "model",
    providerId: "prov",
    status: "working",
    latencyP50: 500,
    latencyP95: 700,
    successRate: 0.85,
    supportsVision: false,
    supportsToolCall: false,
    supportsStreaming: false,
    supportsStructuredOutput: false,
    maxContextWindow: null,
    maxOutputTokens: null,
    categories: ["fast"],
    fitnessScores: {} as Record<string, number>,
    tier: "balanced",
    lastTested: null,
    lastError: null,
    consecutiveFails: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("calculateFitness dampens under-sampled speed and success observations", () => {
  const categorizer = new Categorizer();
  const reliable = buildAssessment({
    id: "prov/reliable",
    modelId: "reliable",
    tier: "fast",
    latencyP50: 1600,
    successRate: 0.95,
    probeCount: 24,
  });
  const underSampled = buildAssessment({
    id: "prov/under-sampled",
    modelId: "under-sampled",
    tier: "fast",
    latencyP50: 120,
    successRate: 1,
    probeCount: 1,
  });

  const reliableScore = categorizer.calculateFitness(reliable, "fast");
  const underSampledScore = categorizer.calculateFitness(underSampled, "fast");

  assert.ok(
    reliableScore > underSampledScore,
    `Expected reliable model to outrank low-sample model (${reliableScore.toFixed(4)} <= ${underSampledScore.toFixed(4)})`
  );
});

test("calculateFitness preserves existing behavior when sample count is unavailable", () => {
  const categorizer = new Categorizer();
  const legacyAssessment = buildAssessment({
    id: "prov/legacy",
    modelId: "legacy",
    tier: "fast",
    latencyP50: 300,
    successRate: 0.91,
  }) as Omit<ModelAssessment, "probeCount" | "sampleCount">;

  const legacyScore = categorizer.calculateFitness(legacyAssessment as ModelAssessment, "fast");
  const rawSpeedScore = 1 - 300 / 15000;
  const expectedScore = 0.1 * 0.5 + 0.6 * rawSpeedScore + 0.3 * 0.91;

  assert.ok(Math.abs(legacyScore - expectedScore) < 0.00001);
});

