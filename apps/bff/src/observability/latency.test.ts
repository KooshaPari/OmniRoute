import { describe, expect, it } from "vitest";

import { summarizeLatencySamples } from "./latency";

const sample = (durationMs: number, status = 200) => ({
  schemaVersion: 1,
  route: "/healthz",
  method: "GET",
  durationMs,
  status,
});

describe("latency sample v1 aggregation", () => {
  it("defines empty and sparse semantics", () => {
    expect(summarizeLatencySamples([])).toEqual({
      schemaVersion: 1,
      sampleCount: 0,
      errorCount: 0,
      errorRate: null,
      p50Ms: null,
      p95Ms: null,
      p99Ms: null,
    });
    expect(summarizeLatencySamples([sample(7)])).toMatchObject({
      sampleCount: 1,
      errorRate: 0,
      p50Ms: 7,
      p95Ms: 7,
      p99Ms: 7,
    });
  });

  it("drops invalid samples and counts only server errors", () => {
    expect(
      summarizeLatencySamples([
        sample(10),
        sample(20, 500),
        sample(30, 404),
        { ...sample(1), durationMs: Number.NaN },
        { ...sample(1), route: "not-a-route" },
      ])
    ).toMatchObject({ sampleCount: 3, errorCount: 1, errorRate: 1 / 3 });
  });

  it("uses deterministic nearest-rank percentiles with ties", () => {
    const result = summarizeLatencySamples([1, 1, 2, 2, 100].map((value) => sample(value)));
    expect(result).toMatchObject({ p50Ms: 2, p95Ms: 100, p99Ms: 100 });
  });

  it.each([
    "/users/12345",
    "/users/550e8400-e29b-41d4-a716-446655440000",
    "/search?q=secret",
    "/token/%2Fprivate",
    `/${"a".repeat(161)}`,
  ])("rejects concrete, sensitive, or unbounded route %s", (route) => {
    expect(summarizeLatencySamples([{ ...sample(1), route }]).sampleCount).toBe(0);
  });

  it("accepts normalized parameter templates", () => {
    expect(summarizeLatencySamples([{ ...sample(1), route: "/users/:id" }]).sampleCount).toBe(1);
  });
});
