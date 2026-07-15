/**
 * Tests for pure-logic helpers in providerHealthHistory.
 *
 * The DB-bound functions (appendHealthSample, recentSamplesFor,
 * pruneSamplesBefore) require a live SQLite and are exercised by the
 * integration test in tests/integration; here we pin the telemetry-hash
 * invariants so the AnomalyDetector can rely on them.
 */

import { describe, test, expect } from "vitest";
import {
  computeTelemetryHash,
  type ProviderHealthSample,
} from "../providerHealthHistory";

function sample(partial: Partial<ProviderHealthSample> = {}): ProviderHealthSample {
  return {
    providerKey: "openai/gpt-4o",
    sampledAt: 1_700_000_000,
    errorRate: 0.0123,
    p95LatencyMs: 842.7,
    activeComboCount: 3,
    consecutiveFailures: 0,
    samplesWindow: 60,
    ...partial,
  };
}

describe("computeTelemetryHash", () => {
  test("is deterministic for the same tuple", () => {
    const a = sample();
    const b = sample();
    expect(computeTelemetryHash(a)).toBe(computeTelemetryHash(b));
  });

  test("flips when sampledAt changes by one second", () => {
    const a = sample();
    const b = sample({ sampledAt: a.sampledAt + 1 });
    expect(computeTelemetryHash(a)).not.toBe(computeTelemetryHash(b));
  });

  test("flips when errorRate changes in the 6th decimal", () => {
    const a = sample({ errorRate: 0.012345 });
    const b = sample({ errorRate: 0.012346 });
    expect(computeTelemetryHash(a)).not.toBe(computeTelemetryHash(b));
  });

  test("is exactly 16 hex chars (64 bits)", () => {
    const h = computeTelemetryHash(sample());
    expect(h).toMatch(/^[0-9a-f]{16}$/);
  });

  test("flips when providerKey changes", () => {
    const a = sample({ providerKey: "openai/gpt-4o" });
    const b = sample({ providerKey: "anthropic/claude-3-5-sonnet" });
    expect(computeTelemetryHash(a)).not.toBe(computeTelemetryHash(b));
  });
});
