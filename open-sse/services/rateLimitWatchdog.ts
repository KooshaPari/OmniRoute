// ── Rate Limit Watchdog ─────────────────────────────────────────────────────
// Detects Bottleneck limiters that are wedged (queue has work, but no jobs are
// dispatched) or idle, and cleans them up.

import type Bottleneck from "bottleneck";

export interface WatchdogContext {
  limiters: Map<string, Bottleneck>;
  limiterLastUsed: Map<string, number>;
  lastDispatchAt: Map<string, number>;
  pendingAsyncOperations: Set<Promise<unknown>>;
  logRateLimit: (...args: unknown[]) => void;
  warnRateLimit: (...args: unknown[]) => void;
  trackAsyncOperation: <T>(promise: Promise<T>) => Promise<T>;
}

const INACTIVE_LIMITER_MS = 10 * 60 * 1000;
const WATCHDOG_INTERVAL_MS = 30_000;
const WEDGE_THRESHOLD_MS = 120_000;

let watchdogInterval: ReturnType<typeof setInterval> | null = null;
let shutdownHandlersRegistered = false;

export function startRateLimitWatchdog(ctx: WatchdogContext): void {
  if (watchdogInterval) return;
  watchdogInterval = setInterval(() => watchdogTick(ctx), WATCHDOG_INTERVAL_MS);
  watchdogInterval.unref?.();
  // Register SIGTERM/SIGINT shutdown handlers once, lazily, on first watchdog start.
  if (!shutdownHandlersRegistered) {
    shutdownHandlersRegistered = true;
    process.once("SIGTERM", () => shutdownLimiters(ctx));
    process.once("SIGINT", () => shutdownLimiters(ctx));
  }
}

export function stopRateLimitWatchdog(): void {
  if (!watchdogInterval) return;
  clearInterval(watchdogInterval);
  watchdogInterval = null;
}

/**
 * Gracefully stop all limiters for process shutdown.
 */
export function shutdownLimiters(ctx: WatchdogContext): void {
  for (const limiter of ctx.limiters.values()) {
    limiter.stop({ dropWaitingJobs: false });
  }
  ctx.limiters.clear();
  ctx.lastDispatchAt.clear();
  ctx.limiterLastUsed.clear();
}

export function watchdogTick(ctx: WatchdogContext): void {
  const { limiters, limiterLastUsed, lastDispatchAt, logRateLimit, warnRateLimit, trackAsyncOperation, pendingAsyncOperations } = ctx;
  const now = Date.now();
  // Clean up idle limiters that haven't been used recently
  for (const [key, limiter] of Array.from(limiters)) {
    const lastUsed = limiterLastUsed.get(key) ?? 0;
    if (now - lastUsed > INACTIVE_LIMITER_MS) {
      const counts = limiter.counts();
      if (counts.QUEUED === 0 && counts.RUNNING === 0 && counts.EXECUTING === 0) {
        limiters.delete(key);
        lastDispatchAt.delete(key);
        limiterLastUsed.delete(key);
        logRateLimit(
          `🧹 [RATE-LIMIT] Evicting idle limiter: ${key} (inactive for ${Math.round((now - lastUsed) / 1000)}s)`
        );
        trackAsyncOperation(limiter.disconnect());
      }
    }
  }
  for (const [key, limiter] of Array.from(limiters)) {
    const counts = limiter.counts();
    if (counts.QUEUED === 0) continue;
    if (counts.RUNNING > 0 || counts.EXECUTING > 0) continue;
    const lastDispatch = lastDispatchAt.get(key);
    // No heartbeat yet → seed it and skip this tick.
    if (lastDispatch === undefined) {
      lastDispatchAt.set(key, now);
      continue;
    }
    const stalledMs = now - lastDispatch;
    if (stalledMs < WEDGE_THRESHOLD_MS) continue;

    warnRateLimit(
      `🚨 [RATE-LIMIT] WEDGED: ${key} queued=${counts.QUEUED} running=0 executing=0 stalled=${stalledMs}ms — force-resetting`
    );
    limiters.delete(key);
    lastDispatchAt.delete(key);
    limiterLastUsed.delete(key);
    trackAsyncOperation(limiter.disconnect());
  }
}

export function resetWatchdogForTests(): void {
  stopRateLimitWatchdog();
  shutdownHandlersRegistered = false;
}
