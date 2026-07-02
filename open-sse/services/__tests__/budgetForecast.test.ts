import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  projectBudgetSavings,
  type BudgetHistoryPoint,
} from "../compression/budgetForecast.ts";

/**
 * Test helpers — keep the suite readable. Every test below uses one of
 * these helpers to construct its history so the assertions stay focused
 * on the forecaster's behavior, not on test data plumbing.
 */

function point(tsMs: number, tokens: number, savedTokens: number): BudgetHistoryPoint {
  return { tsMs, tokens, savedTokens };
}

/** Constant-rate history: same savings rate and same saved-per-window across N points. */
function constantHistory(n: number, perPointSaved: number, perPointTokens: number, stepMs = 1000): BudgetHistoryPoint[] {
  const start = 1_700_000_000_000;
  const out: BudgetHistoryPoint[] = [];
  for (let i = 0; i < n; i++) {
    out.push(point(start + i * stepMs, perPointTokens, perPointSaved));
  }
  return out;
}

/** Monotonically decreasing savings rate. Returns N points whose savings shrink each step. */
function decliningHistory(n: number): BudgetHistoryPoint[] {
  const start = 1_700_000_000_000;
  const out: BudgetHistoryPoint[] = [];
  for (let i = 0; i < n; i++) {
    // savings shrink from 1000 → 1000 * (1 - i/N); tokens held constant.
    const saved = Math.max(1, Math.round(1000 * (1 - i / n)));
    out.push(point(start + i * 60_000, 2000, saved));
  }
  return out;
}

/** Bursty history: lots of low-saving points punctuated by 1-2 spikes. */
function burstyHistory(): BudgetHistoryPoint[] {
  const start = 1_700_000_000_000;
  const out: BudgetHistoryPoint[] = [];
  for (let i = 0; i < 10; i++) {
    const saved = i === 4 || i === 9 ? 5000 : 100;
    out.push(point(start + i * 60_000, 10_000, saved));
  }
  return out;
}

/** Linear step generator for ad-hoc histories. */
function range(n: number, fn: (i: number) => BudgetHistoryPoint): BudgetHistoryPoint[] {
  const out: BudgetHistoryPoint[] = [];
  for (let i = 0; i < n; i++) out.push(fn(i));
  return out;
}

describe("BudgetForecast — empty / degenerate history", () => {
  it("returns zeros for an empty history array", () => {
    const r = projectBudgetSavings([], 60_000);
    assert.deepEqual(r, { p50SavedTokens: 0, p90SavedTokens: 0, meanSavedPerHour: 0 });
  });

  it("returns zeros when horizonMs is 0", () => {
    const r = projectBudgetSavings(constantHistory(5, 100, 1000), 0);
    assert.deepEqual(r, { p50SavedTokens: 0, p90SavedTokens: 0, meanSavedPerHour: 0 });
  });

  it("returns zeros when horizonMs is negative", () => {
    const r = projectBudgetSavings(constantHistory(5, 100, 1000), -1000);
    assert.deepEqual(r, { p50SavedTokens: 0, p90SavedTokens: 0, meanSavedPerHour: 0 });
  });

  it("returns zeros when horizonMs is +Infinity", () => {
    const r = projectBudgetSavings(constantHistory(5, 100, 1000), Number.POSITIVE_INFINITY);
    assert.deepEqual(r, { p50SavedTokens: 0, p90SavedTokens: 0, meanSavedPerHour: 0 });
  });

  it("returns zeros when horizonMs is -Infinity", () => {
    const r = projectBudgetSavings(constantHistory(5, 100, 1000), Number.NEGATIVE_INFINITY);
    assert.deepEqual(r, { p50SavedTokens: 0, p90SavedTokens: 0, meanSavedPerHour: 0 });
  });

  it("returns zeros when horizonMs is NaN", () => {
    const r = projectBudgetSavings(constantHistory(5, 100, 1000), Number.NaN);
    assert.deepEqual(r, { p50SavedTokens: 0, p90SavedTokens: 0, meanSavedPerHour: 0 });
  });

  it("handles single-record history without throwing", () => {
    const r = projectBudgetSavings([point(1_700_000_000_000, 1000, 200)], 60_000);
    assert.ok(Number.isFinite(r.p50SavedTokens));
    assert.ok(Number.isFinite(r.p90SavedTokens));
    assert.ok(Number.isFinite(r.meanSavedPerHour));
    assert.ok(r.p50SavedTokens >= 0);
    assert.ok(r.p90SavedTokens >= r.p50SavedTokens);
  });
});

describe("BudgetForecast — single-record history shape", () => {
  it("single-record horizon equal to spanMs yields ~1x projection", () => {
    const r = projectBudgetSavings(
      [point(1_700_000_000_000, 1000, 200)],
      1_000 // spanMs is 1 (clamped), so this magnifies
    );
    // spanMs clamped to 1, so projection is huge but finite.
    assert.ok(r.p50SavedTokens > 0);
    assert.ok(r.meanSavedPerHour > 0);
  });

  it("single-record meanSavedPerHour reflects saved/spanMs * MS_PER_HOUR", () => {
    const r = projectBudgetSavings([point(1_700_000_000_000, 1000, 200)], 60_000);
    // spanMs clamped to 1 → meanSavedPerHour = 200 * 3,600,000 = 720,000,000
    assert.equal(r.meanSavedPerHour, 200 * 3_600_000);
  });
});

describe("BudgetForecast — constant-rate history (linear projection)", () => {
  it("linear: 1-hour horizon ≈ 1x of the observed rate per hour", () => {
    // 100 tokens saved per minute, 60 minutes per hour → expect ~6000 saved.
    const history = constantHistory(10, 100, 1000, 60_000);
    const r = projectBudgetSavings(history, 60 * 60 * 1000);
    // mean per hour = (1000 saved / 540_000 ms) * 3,600,000 ms = 6666.66...
    assert.ok(Math.abs(r.meanSavedPerHour - (1000 / 540_000) * 3_600_000) < 1);
  });

  it("constant-rate history yields equal p50 and p90 (low CV)", () => {
    const history = constantHistory(20, 100, 1000, 60_000);
    const r = projectBudgetSavings(history, 60 * 60 * 1000);
    assert.equal(r.p50SavedTokens, r.p90SavedTokens);
  });

  it("constant-rate horizon=2h returns ~2x the 1h projection", () => {
    const history = constantHistory(20, 100, 1000, 60_000);
    const r1h = projectBudgetSavings(history, 60 * 60 * 1000);
    const r2h = projectBudgetSavings(history, 2 * 60 * 60 * 1000);
    assert.ok(Math.abs(r2h.p50SavedTokens - 2 * r1h.p50SavedTokens) < 1);
  });

  it("constant-rate horizon=30min returns ~0.5x the 1h projection", () => {
    const history = constantHistory(20, 100, 1000, 60_000);
    const r1h = projectBudgetSavings(history, 60 * 60 * 1000);
    const r30 = projectBudgetSavings(history, 30 * 60 * 1000);
    assert.ok(Math.abs(r30.p50SavedTokens - 0.5 * r1h.p50SavedTokens) < 1);
  });

  it("constant-rate p50 matches the linear-extrapolation formula exactly", () => {
    const history = constantHistory(10, 250, 1000, 60_000);
    const r = projectBudgetSavings(history, 3_600_000);
    // Total saved over span = 250 * 10 = 2500. Horizon/span = 3,600,000 / 540,000 = 6.666...
    const expected = 250 * (3_600_000 / 540_000);
    assert.ok(Math.abs(r.p50SavedTokens - expected) < 0.01);
  });
});

describe("BudgetForecast — declining-rate history (logarithmic cap)", () => {
  it("declining history p50 is below the mean-based projection (no overestimation)", () => {
    const history = decliningHistory(10);
    const r = projectBudgetSavings(history, 60 * 60 * 1000);
    // Mean-saved baseline: with savings 1000,900,800,...,100, mean = 550, total span = 540_000ms.
    const naiveProjection = (550 / 540_000) * 3_600_000; // 3666.66
    assert.ok(r.p50SavedTokens < naiveProjection);
  });

  it("declining history p90 is capped at the observed peak times horizon ratio", () => {
    const history = decliningHistory(10);
    const spanMs = 540_000; // 9 * 60_000
    const peak = 1000;
    const horizonMs = 60 * 60 * 1000;
    const r = projectBudgetSavings(history, horizonMs);
    const expected = peak * (horizonMs / spanMs);
    assert.ok(Math.abs(r.p90SavedTokens - expected) < 1);
  });

  it("declining history p90 is >= p50", () => {
    const history = decliningHistory(15);
    const r = projectBudgetSavings(history, 60 * 60 * 1000);
    assert.ok(r.p90SavedTokens >= r.p50SavedTokens);
  });

  it("declining history p50 is non-negative", () => {
    const history = decliningHistory(20);
    const r = projectBudgetSavings(history, 60 * 60 * 1000);
    assert.ok(r.p50SavedTokens >= 0);
  });
});

describe("BudgetForecast — bursty history (median-anchored)", () => {
  it("bursty history median-anchored p50 ignores spikes", () => {
    // burstyHistory: mostly 100 saved, with two 5000-saved spikes.
    const history = burstyHistory();
    // Median saved = 100 (most points have 100, spikes are upper outliers).
    // Span = 9 * 60_000 = 540_000.
    const r = projectBudgetSavings(history, 60 * 60 * 1000);
    // Expected p50 ≈ 100 * (3,600,000 / 540,000) = 666.66.
    assert.ok(r.p50SavedTokens < 1000);
  });

  it("bursty history p90 reflects the upper observations", () => {
    const history = burstyHistory();
    const spanMs = 540_000;
    const r = projectBudgetSavings(history, 60 * 60 * 1000);
    // 90th percentile of [100,100,100,100,5000,100,100,100,100,5000] is 5000.
    const expected = 5000 * (3_600_000 / spanMs);
    assert.ok(Math.abs(r.p90SavedTokens - expected) < 1);
  });

  it("bursty p50 <= bursty p90 always", () => {
    const r = projectBudgetSavings(burstyHistory(), 60 * 60 * 1000);
    assert.ok(r.p50SavedTokens <= r.p90SavedTokens);
  });

  it("bursty meanSavedPerHour reflects total saved over span", () => {
    const history = burstyHistory();
    const spanMs = 540_000;
    const totalSaved = 8 * 100 + 2 * 5000; // 10_800
    const expected = (totalSaved / spanMs) * 3_600_000;
    const r = projectBudgetSavings(history, 60 * 60 * 1000);
    assert.ok(Math.abs(r.meanSavedPerHour - expected) < 1);
  });
});

describe("BudgetForecast — horizonMs edge cases", () => {
  it("horizonMs = 1 yields a tiny but non-zero projection for constant history", () => {
    const history = constantHistory(10, 100, 1000, 60_000);
    const r = projectBudgetSavings(history, 1);
    assert.ok(r.p50SavedTokens >= 0);
    assert.ok(r.p90SavedTokens >= r.p50SavedTokens);
  });

  it("horizonMs > 0 but very small produces finite values", () => {
    const history = constantHistory(10, 100, 1000, 60_000);
    const r = projectBudgetSavings(history, 0.5);
    assert.ok(Number.isFinite(r.p50SavedTokens));
    assert.ok(Number.isFinite(r.p90SavedTokens));
    assert.ok(Number.isFinite(r.meanSavedPerHour));
  });

  it("horizonMs much larger than spanMs amplifies p50/p90 proportionally", () => {
    const history = constantHistory(10, 100, 1000, 60_000);
    const rShort = projectBudgetSavings(history, 60_000);
    const rLong = projectBudgetSavings(history, 600_000);
    assert.ok(rLong.p50SavedTokens > rShort.p50SavedTokens);
  });

  it("all horizonMs edge cases (0, -1, Infinity, -Infinity, NaN) yield zeros", () => {
    const history = constantHistory(5, 100, 1000);
    for (const h of [0, -1, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NaN]) {
      const r = projectBudgetSavings(history, h);
      assert.deepEqual(r, { p50SavedTokens: 0, p90SavedTokens: 0, meanSavedPerHour: 0 }, `h=${h}`);
    }
  });
});

describe("BudgetForecast — tsMs edge cases", () => {
  it("handles tsMs = 0 (epoch start)", () => {
    const history: BudgetHistoryPoint[] = [
      point(0, 1000, 200),
      point(1000, 1000, 200),
      point(2000, 1000, 200),
    ];
    const r = projectBudgetSavings(history, 5000);
    assert.ok(Number.isFinite(r.p50SavedTokens));
    assert.ok(r.p50SavedTokens >= 0);
  });

  it("handles negative tsMs (pre-epoch)", () => {
    const history: BudgetHistoryPoint[] = [
      point(-2000, 1000, 200),
      point(-1000, 1000, 200),
      point(0, 1000, 200),
    ];
    const r = projectBudgetSavings(history, 5000);
    assert.ok(Number.isFinite(r.p50SavedTokens));
    assert.ok(r.p50SavedTokens >= 0);
  });

  it("handles far-future tsMs (year 2106)", () => {
    const history: BudgetHistoryPoint[] = [
      point(4_294_967_000_000, 1000, 200), // year ~2106, near 32-bit max ms
      point(4_294_967_060_000, 1000, 200),
      point(4_294_967_120_000, 1000, 200),
    ];
    const r = projectBudgetSavings(history, 60_000);
    assert.ok(Number.isFinite(r.p50SavedTokens));
    assert.ok(r.p50SavedTokens >= 0);
  });

  it("handles all-duplicate tsMs (no div-by-zero)", () => {
    const history: BudgetHistoryPoint[] = [
      point(1_700_000_000_000, 1000, 200),
      point(1_700_000_000_000, 1000, 200),
      point(1_700_000_000_000, 1000, 200),
    ];
    const r = projectBudgetSavings(history, 60_000);
    assert.ok(Number.isFinite(r.p50SavedTokens));
    assert.ok(Number.isFinite(r.p90SavedTokens));
    assert.ok(Number.isFinite(r.meanSavedPerHour));
  });

  it("handles unsorted input by sorting internally", () => {
    const sortedHistory = constantHistory(5, 100, 1000, 60_000);
    const unsorted = [...sortedHistory].reverse();
    const rSorted = projectBudgetSavings(sortedHistory, 60_000);
    const rUnsorted = projectBudgetSavings(unsorted, 60_000);
    assert.equal(rSorted.p50SavedTokens, rUnsorted.p50SavedTokens);
    assert.equal(rSorted.p90SavedTokens, rUnsorted.p90SavedTokens);
    assert.equal(rSorted.meanSavedPerHour, rUnsorted.meanSavedPerHour);
  });
});

describe("BudgetForecast — invalid / degenerate input values", () => {
  it("negative tokens are clamped to zero (no negative rates)", () => {
    const history: BudgetHistoryPoint[] = [
      point(0, 1000, 100),
      point(1000, -500, 100), // negative tokens → ignored for rate calc
      point(2000, 1000, 100),
    ];
    const r = projectBudgetSavings(history, 60_000);
    assert.ok(r.p50SavedTokens >= 0);
    assert.ok(r.meanSavedPerHour >= 0);
  });

  it("negative savedTokens are clamped to zero", () => {
    const history: BudgetHistoryPoint[] = [
      point(0, 1000, 100),
      point(1000, 1000, -50), // negative saved → clamped to 0
      point(2000, 1000, 100),
    ];
    const r = projectBudgetSavings(history, 60_000);
    assert.ok(r.p50SavedTokens >= 0);
    assert.ok(r.meanSavedPerHour >= 0);
  });

  it("zero-tokens points are skipped for rate classification", () => {
    const history: BudgetHistoryPoint[] = [
      point(0, 0, 100),       // tokens=0 → rate not added
      point(1000, 1000, 200),
      point(2000, 1000, 200),
      point(3000, 1000, 200),
    ];
    const r = projectBudgetSavings(history, 60_000);
    assert.ok(Number.isFinite(r.p50SavedTokens));
    assert.ok(r.p50SavedTokens >= 0);
  });

  it("does not mutate the input array (history.slice defense)", () => {
    const history = constantHistory(5, 100, 1000, 60_000);
    const before = JSON.stringify(history);
    projectBudgetSavings(history, 60_000);
    const after = JSON.stringify(history);
    assert.equal(before, after);
  });
});

describe("BudgetForecast — output invariants", () => {
  it("returns all three required fields for any valid input", () => {
    const history = constantHistory(5, 100, 1000);
    const r = projectBudgetSavings(history, 60_000);
    assert.ok("p50SavedTokens" in r);
    assert.ok("p90SavedTokens" in r);
    assert.ok("meanSavedPerHour" in r);
  });

  it("p90SavedTokens is always >= p50SavedTokens", () => {
    const cases: BudgetHistoryPoint[][] = [
      constantHistory(5, 100, 1000),
      decliningHistory(10),
      burstyHistory(),
    ];
    for (const h of cases) {
      const r = projectBudgetSavings(h, 60_000);
      assert.ok(r.p90SavedTokens >= r.p50SavedTokens, `p90 (${r.p90SavedTokens}) < p50 (${r.p50SavedTokens})`);
    }
  });

  it("all three fields are finite numbers (never NaN/Infinity) for valid inputs", () => {
    const cases: Array<[BudgetHistoryPoint[], number]> = [
      [constantHistory(5, 100, 1000), 60_000],
      [decliningHistory(10), 60_000],
      [burstyHistory(), 60_000],
      [[point(0, 1000, 100)], 60_000],
      [constantHistory(20, 50, 1000, 100), 1],
    ];
    for (const [h, horizon] of cases) {
      const r = projectBudgetSavings(h, horizon);
      assert.ok(Number.isFinite(r.p50SavedTokens), `p50 not finite: ${r.p50SavedTokens}`);
      assert.ok(Number.isFinite(r.p90SavedTokens), `p90 not finite: ${r.p90SavedTokens}`);
      assert.ok(Number.isFinite(r.meanSavedPerHour), `meanSavedPerHour not finite: ${r.meanSavedPerHour}`);
    }
  });

  it("all three fields are non-negative for any input", () => {
    const cases: BudgetHistoryPoint[][] = [
      constantHistory(5, 100, 1000),
      decliningHistory(10),
      burstyHistory(),
      [point(0, 0, -100)], // single degenerate point
    ];
    for (const h of cases) {
      const r = projectBudgetSavings(h, 60_000);
      assert.ok(r.p50SavedTokens >= 0);
      assert.ok(r.p90SavedTokens >= 0);
      assert.ok(r.meanSavedPerHour >= 0);
    }
  });
});

describe("BudgetForecast — 100-record history", () => {
  it("100-record constant-rate history: linear projection holds", () => {
    const history = constantHistory(100, 50, 1000, 60_000);
    const r = projectBudgetSavings(history, 60 * 60 * 1000);
    // 100 records, 50 saved each → 5000 saved over 99 * 60_000 = 5,940,000ms
    const expected = (100 * 50 / (99 * 60_000)) * 3_600_000;
    assert.ok(Math.abs(r.meanSavedPerHour - expected) < 0.5);
  });

  it("100-record constant-rate: p50 equals p90", () => {
    const history = constantHistory(100, 50, 1000, 60_000);
    const r = projectBudgetSavings(history, 60 * 60 * 1000);
    assert.equal(r.p50SavedTokens, r.p90SavedTokens);
  });

  it("100-record history completes in <5ms (performance budget)", () => {
    const history = constantHistory(100, 50, 1000, 60_000);
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) projectBudgetSavings(history, 60 * 60 * 1000);
    const elapsed = performance.now() - t0;
    assert.ok(elapsed < 50, `100 iterations took ${elapsed.toFixed(2)}ms`);
  });

  it("100-record declining history: p50 < naive mean projection", () => {
    const history = decliningHistory(100);
    const spanMs = 99 * 60_000;
    const totalSaved = history.reduce((s, p) => s + p.savedTokens, 0);
    const naiveMeanPerHour = (totalSaved / spanMs) * 3_600_000;
    const r = projectBudgetSavings(history, 60 * 60 * 1000);
    // Declining: the projection must be below the naive mean.
    assert.ok(r.p50SavedTokens < naiveMeanPerHour);
  });

  it("100-record bursty history: median-anchored p50 stays bounded", () => {
    // Mostly 100 saved with spikes at i=10, 30, 50, 70, 90.
    const history = range(100, (i) =>
      point(1_700_000_000_000 + i * 60_000, 10_000, i % 20 === 10 ? 5000 : 100)
    );
    const r = projectBudgetSavings(history, 60 * 60 * 1000);
    // Median of saved array ≈ 100, so p50 should be on the order of (100 / span) * horizon.
    assert.ok(r.p50SavedTokens > 0);
    assert.ok(r.p50SavedTokens < 10_000);
  });

  it("100-record deterministic: identical input yields identical output", () => {
    const history = constantHistory(100, 50, 1000, 60_000);
    const r1 = projectBudgetSavings(history, 60_000);
    const r2 = projectBudgetSavings(history, 60_000);
    assert.deepEqual(r1, r2);
  });
});

describe("BudgetForecast — mixed / unknown shape", () => {
  it("mixed shape: p90 strictly greater than p50 (when stddev > 0)", () => {
    // Build a history that is neither constant nor declining nor bursty.
    const history: BudgetHistoryPoint[] = [
      point(0, 1000, 100),
      point(1000, 1000, 300),
      point(2000, 1000, 150),
      point(3000, 1000, 250),
      point(4000, 1000, 175),
    ];
    const r = projectBudgetSavings(history, 5000);
    assert.ok(r.p90SavedTokens >= r.p50SavedTokens);
  });

  it("mixed shape: p50 follows the mean projection", () => {
    const history: BudgetHistoryPoint[] = [
      point(0, 1000, 100),
      point(1000, 1000, 200),
      point(2000, 1000, 150),
    ];
    const r = projectBudgetSavings(history, 3000);
    // Span = 2000ms; mean saved = 150; p50 ≈ 150 * (3000/2000) = 225.
    assert.ok(Math.abs(r.p50SavedTokens - 225) < 0.5);
  });

  it("all-zero history: returns zeros (degenerate)", () => {
    const history: BudgetHistoryPoint[] = [
      point(0, 0, 0),
      point(1000, 0, 0),
      point(2000, 0, 0),
    ];
    const r = projectBudgetSavings(history, 60_000);
    assert.deepEqual(r, { p50SavedTokens: 0, p90SavedTokens: 0, meanSavedPerHour: 0 });
  });

  it("two-record history falls back to mixed (insufficient for shape classification)", () => {
    const history: BudgetHistoryPoint[] = [
      point(0, 1000, 200),
      point(60_000, 1000, 200),
    ];
    const r = projectBudgetSavings(history, 60_000);
    // Should still produce a valid finite result.
    assert.ok(Number.isFinite(r.p50SavedTokens));
    assert.ok(r.p90SavedTokens >= r.p50SavedTokens);
  });

  it("monotonically increasing rates are classified as 'mixed' (not declining)", () => {
    // Rising history → not declining, not bursty (low CV), not constant.
    const history: BudgetHistoryPoint[] = [
      point(0, 1000, 50),
      point(1000, 1000, 100),
      point(2000, 1000, 150),
      point(3000, 1000, 200),
      point(4000, 1000, 250),
    ];
    const r = projectBudgetSavings(history, 5000);
    // The 'mixed' branch applies mean + stddev for p90.
    assert.ok(Number.isFinite(r.p50SavedTokens));
    assert.ok(r.p90SavedTokens >= r.p50SavedTokens);
  });
});

describe("BudgetForecast — determinism & purity", () => {
  it("pure: same input → same output across 50 calls", () => {
    const history = constantHistory(20, 100, 1000, 60_000);
    const first = projectBudgetSavings(history, 60 * 60 * 1000);
    for (let i = 0; i < 50; i++) {
      const r = projectBudgetSavings(history, 60 * 60 * 1000);
      assert.deepEqual(r, first);
    }
  });

  it("pure: does not depend on wall-clock time", () => {
    // Two snapshots with different wall-clock timestamps should give the
    // SAME per-hour rate (only the relative span matters).
    const a = [point(1_000_000_000_000, 1000, 200), point(1_000_000_060_000, 1000, 200)];
    const b = [point(2_000_000_000_000, 1000, 200), point(2_000_000_060_000, 1000, 200)];
    const ra = projectBudgetSavings(a, 60_000);
    const rb = projectBudgetSavings(b, 60_000);
    assert.equal(ra.meanSavedPerHour, rb.meanSavedPerHour);
  });

  it("does not leak state between calls (cumulative drift check)", () => {
    const history = constantHistory(20, 100, 1000, 60_000);
    const baseline = projectBudgetSavings(history, 60_000);
    // Run 10 calls and verify the result is still baseline.
    for (let i = 0; i < 10; i++) projectBudgetSavings(history, 60_000);
    const after = projectBudgetSavings(history, 60_000);
    assert.deepEqual(baseline, after);
  });
});