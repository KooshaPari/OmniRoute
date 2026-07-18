import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildKeyUsageSeries,
  buildObservabilityLatencySeries,
  buildTimeSeries,
} from "../../../src/routes/timeSeries";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildTimeSeries", () => {
  it("captures the clock once and preserves count, order, spacing, and mapped values", () => {
    const now = vi.fn(() => Date.UTC(2026, 6, 14, 12));

    const points = buildTimeSeries({
      count: 3,
      stepMs: 60_000,
      now,
      mapPoint: (index, timestampMs) => ({ index, timestampMs, value: index * 10 }),
    });

    expect(now).toHaveBeenCalledTimes(1);
    expect(points).toEqual([
      { index: 0, timestampMs: Date.UTC(2026, 6, 14, 11, 58), value: 0 },
      { index: 1, timestampMs: Date.UTC(2026, 6, 14, 11, 59), value: 10 },
      { index: 2, timestampMs: Date.UTC(2026, 6, 14, 12), value: 20 },
    ]);
  });

  it("supports a trailing offset while retaining uniform spacing", () => {
    const points = buildTimeSeries({
      count: 2,
      stepMs: 1_000,
      now: () => 10_000,
      endOffsetSteps: 1,
      mapPoint: (_, timestampMs) => timestampMs,
    });

    expect(points).toEqual([8_000, 9_000]);
  });
});

describe("dashboard time-series builders", () => {
  it("preserves the observability response shape and captures its clock once", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 6, 14, 12));
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5);

    const points = buildObservabilityLatencySeries();

    expect(now).toHaveBeenCalledTimes(1);
    expect(random).toHaveBeenCalledTimes(60);
    expect(points).toHaveLength(60);
    expect(points[0]).toEqual({
      ts: new Date(Date.UTC(2026, 6, 14, 11)).toISOString(),
      latency: 500,
    });
    expect(points[59]).toEqual({
      ts: new Date(Date.UTC(2026, 6, 14, 11, 59)).toISOString(),
      latency: 500,
    });
  });

  it("preserves the key-usage response shape and captures its clock once", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 6, 14, 12));
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5);

    const usage = buildKeyUsageSeries();

    expect(now).toHaveBeenCalledTimes(1);
    expect(random).toHaveBeenCalledTimes(30);
    expect(usage).toHaveLength(30);
    expect(usage[0]).toEqual({ date: "2026-06-15", requests: 500 });
    expect(usage[29]).toEqual({ date: "2026-07-14", requests: 500 });
  });
});
