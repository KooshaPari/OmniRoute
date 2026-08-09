/**
 * chatCooldown.ts — credential cooldown/retry helpers (PR-α).
 *
 * Extracted from `chat.ts` (fork-main) so the 1647-line file can shed one of
 * its largest self-contained concerns. This module owns the wait + log +
 * abort behaviour for "all connections cooling down" — the canonical pattern
 * of "wait, then retry" that fires when every connection is rate-limited
 * and the operator wants to back off rather than fail the request.
 *
 * Public API:
 *   - decideAndWaitForCooldownRetry(...)  : compute + execute the wait
 *   - recordAccountCooldown(...)         : propagate cooldown into retry state
 *   - shouldAbortOnRetryWait(...)        : predicate for "wait was aborted"
 *
 * Internal helpers stay private (not re-exported) to avoid widening the
 * surface area beyond what the upstream consumer actually needs.
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
  const waitSec = Math.max(Math.ceil(decision.waitMs / 1000), 0);
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
