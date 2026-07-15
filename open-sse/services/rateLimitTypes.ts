/**
 * rateLimitTypes.ts — shared types used by rateLimitHeaders.ts, the
 * rateLimitManager orchestrator, and any future rate-limit plugins.
 *
 * Kept tiny on purpose: it's a leaf module so the orchestrator can stay
 * focused on Bottleneck wiring, and so headers / persistence / orchestration
 * can be tested in isolation.
 */

import type { Logger } from "pino";

/**
 * Minimal logger interface — satisfied by pino's Logger and by the test
 * stub used in `tests/unit/...`.
 *
 * Note: we use `LoggerLike` rather than importing `Logger` directly so
 * consumers in the open-sse root (which doesn't depend on pino) can still
 * re-export these types.
 */
export interface LoggerLike {
  trace: Logger["trace"];
  debug: Logger["debug"];
  info: Logger["info"];
  warn: Logger["warn"];
  error: Logger["error"];
  fatal: Logger["fatal"];
  child: Logger["child"];
}

/**
 * Bottleneck limiter-update payload. Subset of Bottleneck's `updateSettings`
 * options that the orchestrator actually uses. Keeping this as a named
 * type catches typos at the boundary.
 */
export interface LimiterUpdateSettings {
  maxConcurrent?: number | null;
  minTime: number;
  reservoir?: number | null;
  reservoirRefreshAmount?: number | null;
  reservoirRefreshInterval?: number | null;
}

/**
 * Persisted shape for a single learned limit entry. Stored as JSON in the
 * local SQLite cache (via `src/lib/db/learnedLimits.ts`) and re-hydrated on
 * orchestrator startup.
 */
export interface LearnedLimitEntry {
  provider: string;
  connectionId: string;
  lastUpdated: number;
  limit?: number;
  remaining?: number;
  minTime?: number;
  model?: string | null;
}