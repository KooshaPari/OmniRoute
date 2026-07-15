/**
 * PR-025 — Compression Budget Forecaster
 *
 * Projects historical compression savings into a future horizon so the cost
 * guard / dashboard / scheduler can answer: "if we keep compressing at the
 * recent rate, how many tokens will we save in the next N ms?"
 *
 * Pure function — no I/O, no Date.now(), no module-level state, deterministic
 * for a given input array. Safe to call from request hot paths and from
 * background job loops.
 *
 * Forecast model (per-history-shape):
 *   - constant-rate history → linear extrapolation of the mean rate
 *   - declining-rate history → log-shaped decay, capped at observed peak
 *   - bursty history → median-anchored projection, ignoring outliers
 *   - mixed / degenerate history → falls back to mean rate
 *
 * All outputs are non-negative finite numbers. The function never throws on
 * caller-provided bad inputs; instead it returns zeros with a documented
 * degenerate-case rationale. Matches the contract used by costRules.ts and
 * the dashboard forecast widget.
 */

export interface BudgetHistoryPoint {
  /** Epoch milliseconds at which this observation was recorded. */
  tsMs: number;
  /** Total tokens observed in the input (pre-compression). */
  tokens: number;
  /** Tokens saved by compression for this observation. */
  savedTokens: number;
}

export interface BudgetForecast {
  /** 50th-percentile projection of saved tokens over the horizon. */
  p50SavedTokens: number;
  /** 90th-percentile projection of saved tokens over the horizon. */
  p90SavedTokens: number;
  /** Mean saved tokens per hour extrapolated from the history window. */
  meanSavedPerHour: number;
}

const MS_PER_HOUR = 60 * 60 * 1000;

/** Deterministic percentile (0–100), linear interpolation, type 7. */
function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0]!;
  if (p <= 0) return sortedAsc[0]!;
  if (p >= 100) return sortedAsc[sortedAsc.length - 1]!;
  const rank = (p / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sortedAsc[lo]!;
  const w = rank - lo;
  return sortedAsc[lo]! * (1 - w) + sortedAsc[hi]! * w;
}

const sortedCopy = (arr: number[]): number[] => arr.slice().sort((a, b) => a - b);
const median = (arr: number[]): number => (arr.length === 0 ? 0 : percentile(sortedCopy(arr), 50));
const mean = (arr: number[]): number => {
  if (arr.length === 0) return 0;
  let sum = 0;
  for (const v of arr) sum += v;
  return sum / arr.length;
};

/**
 * Classify the history shape so the forecaster can pick the right model.
 * Returns: "constant" | "declining" | "bursty" | "mixed"
 */
function classifyShape(
  savingsRates: number[]
): "constant" | "declining" | "bursty" | "mixed" {
  if (savingsRates.length < 3) return "mixed";
  const m = mean(savingsRates);
  if (m <= 0) return "mixed";
  let varianceSum = 0;
  for (const v of savingsRates) varianceSum += (v - m) ** 2;
  const variance = varianceSum / savingsRates.length;
  const stddev = Math.sqrt(variance);
  const cv = stddev / m; // coefficient of variation

  if (cv > 0.6) return "bursty";
  // Constant check first: flat data trivially satisfies any monotonic
  // comparison, so it must be screened before the decreasing check below.
  if (cv < 0.15) return "constant";
  let decreasing = 0;
  for (let i = 1; i < savingsRates.length; i++) {
    // Strict <: a perfectly flat series is constant, not declining.
    if (savingsRates[i]! < savingsRates[i - 1]!) decreasing++;
  }
  if (decreasing >= savingsRates.length - 1) return "declining";
  return "mixed";
}

/**
 * Project compression-token savings into a future horizon given a history
 * window. Pure function — see file header for the forecast model and the
 * no-throw degenerate-case contract.
 */
export function projectBudgetSavings(
  history: ReadonlyArray<BudgetHistoryPoint>,
  horizonMs: number
): BudgetForecast {
  if (!Array.isArray(history) || history.length === 0) {
    return { p50SavedTokens: 0, p90SavedTokens: 0, meanSavedPerHour: 0 };
  }
  if (!Number.isFinite(horizonMs) || horizonMs <= 0) {
    return { p50SavedTokens: 0, p90SavedTokens: 0, meanSavedPerHour: 0 };
  }

  const sorted = history.slice().sort((a, b) => a.tsMs - b.tsMs);
  const rates: number[] = [];
  const savedAbs: number[] = [];
  let totalSaved = 0;
  for (const p of sorted) {
    // Defensive: tolerate malformed entries (null, non-object, missing fields).
    if (!p || typeof p !== "object") continue;
    const saved = Math.max(0, Number(p.savedTokens) || 0);
    const tokens = Math.max(0, Number(p.tokens) || 0);
    savedAbs.push(saved);
    totalSaved += saved;
    if (tokens > 0) rates.push(saved / tokens);
  }
  if (savedAbs.length === 0) {
    return { p50SavedTokens: 0, p90SavedTokens: 0, meanSavedPerHour: 0 };
  }

  // Window span (ms), clamped to ≥1 to avoid div-by-zero on duplicate ts.
  const firstTs = sorted[0]!.tsMs;
  const lastTs = sorted[sorted.length - 1]!.tsMs;
  const spanMs = Math.max(1, lastTs - firstTs);

  const observedRatePerHour = (totalSaved / spanMs) * MS_PER_HOUR;
  const meanSavedPerHour = Math.max(0, observedRatePerHour);

  const shape = classifyShape(rates);
  let p50SavedTokens: number;
  let p90SavedTokens: number;

  if (shape === "bursty") {
    // Bursty: median-anchored (robust to spikes), p90 lifted to a high
    // observation to capture plausible upside.
    const med = median(savedAbs);
    const p90Abs = percentile(sortedCopy(savedAbs), 90);
    p50SavedTokens = Math.max(0, med * (horizonMs / spanMs));
    p90SavedTokens = Math.max(0, p90Abs * (horizonMs / spanMs));
  } else if (shape === "declining") {
    // Declining: mean overestimates the future; cap projection at the latest
    // observation scaled by a log decay that never exceeds the observed peak.
    const peak = Math.max(...savedAbs);
    const latest = savedAbs[savedAbs.length - 1]!;
    const decay = Math.log1p(horizonMs / spanMs) / Math.log1p(2);
    const scale = Math.min(1, Math.max(0, decay));
    p50SavedTokens = Math.max(0, latest * scale * (horizonMs / spanMs));
    p90SavedTokens = Math.max(0, peak * (horizonMs / spanMs));
  } else if (shape === "constant") {
    const m = mean(savedAbs);
    p50SavedTokens = Math.max(0, m * (horizonMs / spanMs));
    p90SavedTokens = Math.max(0, m * (horizonMs / spanMs));
  } else {
    // Mixed / unknown: mean-based p50; p50 + stddev for p90 so they differ.
    const m = mean(savedAbs);
    const sd = Math.sqrt(mean(savedAbs.map((v) => (v - m) ** 2)));
    p50SavedTokens = Math.max(0, m * (horizonMs / spanMs));
    p90SavedTokens = Math.max(0, (m + sd) * (horizonMs / spanMs));
  }

  return {
    p50SavedTokens: Math.max(0, p50SavedTokens),
    p90SavedTokens: Math.max(p50SavedTokens, p90SavedTokens),
    meanSavedPerHour,
  };
}