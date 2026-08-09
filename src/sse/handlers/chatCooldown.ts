/**
 * chatCooldown.ts — credential cooldown/retry helpers (PR-α + PR-ζ).
 *
 * Extracted from `chat.ts` (fork-main) so the 1647-line file can shed one of
 * its largest self-contained concerns. This module owns the wait + log +
 * abort behaviour for "all connections cooling down" — the canonical pattern
 * of "wait, then retry" that fires when every connection is rate-limited
 * and the operator wants to back off rather than fail the request.
 *
 * Public API:
 *   - decideAndWaitForCooldownRetry(...)     : compute + execute the wait
 *   - recordAccountCooldown(...)             : propagate cooldown into retry state
 *   - shouldAbortOnRetryWait(...)            : predicate for "wait was aborted"
 *   - createCooldownPropagationState(...)    : factory for a fresh state object
 *   - describeCooldownWait(...)              : human-readable label for logs/tests
 *   - formatWaitSeconds(...)                 : ceil-divide ms → seconds, clamped ≥ 0
 *
 * Internal helpers stay private (not re-exported) to avoid widening the
 * surface area beyond what the upstream consumer actually needs.
 *
 * PR-ζ adds three fork-original helpers that close test-coverage and
 * ergonomics gaps exposed by the existing PR-α tests:
 *   - createCooldownPropagationState: ergonomic factory; lets callers
 *     skip the `let state = { lastCooldownMs: 0, requestRetryLastCooldownMs: 0 }`
 *     boilerplate and use a typed constructor instead.
 *   - describeCooldownWait: pure formatter that returns "1s" / "5m" /
 *     "1h30m" / "no-retry" labels. Used by tests for log assertions and
 *     by future telemetry/dashboard code to surface retry intent without
 *     re-deriving the math.
 *   - formatWaitSeconds: ceil-divide ms → seconds with the same ≥ 0 clamp
 *     used inside decideAndWaitForCooldownRetry. Lets tests pin the
 *     exact rounding rule without calling the async function.
 */
import type { log as LogType } from "../../shared/utils/log";

export interface CooldownRetryDecision {
  shouldRetry: boolean;
  waitMs: number;
  retryAfterHuman?: string;
}

export interface CooldownRetrySettings {
  maxRetries: number;
  budgetMs: number;
}

export interface CooldownRetryContext {
  provider: string;
  model: string;
  attempt: number;
  requestSignal?: AbortSignal;
}

/**
 * Decide whether to wait + execute the wait. Returns a discriminated
 * union so callers pattern-match instead of throwing.
 */
export async function decideAndWaitForCooldownRetry(
  decision: CooldownRetryDecision,
  ctx: CooldownRetryContext,
  log: typeof LogType,
  retrySettings: CooldownRetrySettings,
): Promise<
  | { outcome: "retry"; waitMs: number }
  | { outcome: "abort" }
  | { outcome: "no_retry" }
> {
  if (!decision.shouldRetry) {
    return { outcome: "no_retry" };
  }
  const waitSec = formatWaitSeconds(decision.waitMs);
  log.info(
    "COOLDOWN_RETRY",
    `${ctx.provider}/${ctx.model} all connections cooling down (${
      decision.retryAfterHuman || `retry in ${waitSec}s`
    }) — waiting ${waitSec}s before retry ${ctx.attempt + 1}/${retrySettings.maxRetries}`
  );

  // Lazy import to avoid a circular dep with the upstream cooldown helper.
  const { waitForCooldownAwareRetry } = await import(
    "../../services/cooldownAwareRetry"
  );
  const completed = await waitForCooldownAwareRetry(decision.waitMs, ctx.requestSignal);
  if (!completed) {
    log.info(
      "COOLDOWN_RETRY",
      `${ctx.provider}/${ctx.model} retry wait aborted by client disconnect`
    );
    return { outcome: "abort" };
  }
  return { outcome: "retry", waitMs: decision.waitMs };
}

/**
 * Predicate: did the wait abort because of a client disconnect?
 */
export function shouldAbortOnRetryWait(completed: boolean): boolean {
  return completed === false;
}

/**
 * Cooldown propagation state. Passed by reference into
 * `recordAccountCooldown` so the helper can update the caller's
 * lastCooldownMs + requestRetryLastCooldownMs in place.
 */
export interface CooldownPropagationState {
  lastCooldownMs: number;
  requestRetryLastCooldownMs: number;
}

/**
 * Factory: return a fresh CooldownPropagationState with both fields
 * initialised to 0. Lets callers avoid the
 *   `let state = { lastCooldownMs: 0, requestRetryLastCooldownMs: 0 }`
 * boilerplate at every call site and use a typed constructor instead.
 */
export function createCooldownPropagationState(
  overrides?: Partial<CooldownPropagationState>,
): CooldownPropagationState {
  return {
    lastCooldownMs: overrides?.lastCooldownMs ?? 0,
    requestRetryLastCooldownMs: overrides?.requestRetryLastCooldownMs ?? 0,
  };
}

/**
 * Propagate the cooldown returned by `markAccountUnavailable` into the
 * retry state, IF the cooldown is finite and positive.
 *
 * Centralises the 3-line `if (Number.isFinite(cooldownMs) && cooldownMs > 0)
 * { lastCooldownMs = cooldownMs; requestRetryLastCooldownMs = cooldownMs; }`
 * pattern that appears multiple times in chat.ts.
 */
export function recordAccountCooldown(
  cooldownMs: number,
  state: CooldownPropagationState,
): boolean {
  if (!Number.isFinite(cooldownMs) || cooldownMs <= 0) {
    return false;
  }
  state.lastCooldownMs = cooldownMs;
  state.requestRetryLastCooldownMs = cooldownMs;
  return true;
}

/**
 * Format a millisecond wait value as a positive integer number of seconds,
 * using ceiling division so a 7500 ms wait shows as 8s (never 7s).
 *
 * Returns 0 for negative, NaN, Infinity, or zero inputs. This matches the
 * inlined `Math.max(Math.ceil(decision.waitMs / 1000), 0)` used inside
 * `decideAndWaitForCooldownRetry` so the log message and the wait logic
 * agree on the same rounded value.
 */
export function formatWaitSeconds(waitMs: number): number {
  if (!Number.isFinite(waitMs) || waitMs <= 0) {
    return 0;
  }
  return Math.ceil(waitMs / 1000);
}

/**
 * Render a CooldownRetryDecision as a short human-readable label suitable
 * for logs, dashboard chips, or test assertions.
 *
 * Output rules:
 *   - shouldRetry=false  → "no-retry"
 *   - waitMs <= 0        → "0s"
 *   - waitMs < 60_000    → "Ns"   (seconds)
 *   - waitMs < 3_600_000 → "Nm"   (minutes)
 *   - otherwise          → "Nh" or "NhMm" (hours + remainder minutes)
 *
 * Always returns a non-empty string. Pure function — never throws.
 */
export function describeCooldownWait(decision: CooldownRetryDecision): string {
  if (!decision.shouldRetry) {
    return "no-retry";
  }
  if (!Number.isFinite(decision.waitMs) || decision.waitMs <= 0) {
    return "0s";
  }
  const totalSeconds = Math.ceil(decision.waitMs / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  if (totalSeconds < 3600) {
    const minutes = Math.ceil(totalSeconds / 60);
    return `${minutes}m`;
  }
  const hours = Math.floor(totalSeconds / 3600);
  const remainderMinutes = Math.ceil((totalSeconds - hours * 3600) / 60);
  return remainderMinutes > 0 ? `${hours}h${remainderMinutes}m` : `${hours}h`;
}
