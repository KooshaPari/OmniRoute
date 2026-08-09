/**
 * chatPredicates.ts — pure predicates and tuning constants for the SSE chat
 * handler. (PR-δ + PR-ε fork-only additions.)
 *
 * Mirrors the existing sibling-decomposition pattern at
 * `src/sse/handlers/chatCooldown.ts`, `chatHelpers.ts`, and
 * `resolveRoutingModel.ts`. chat.ts (currently ~1650 LoC) is the largest
 * file in `src/sse/handlers/` and the biggest contributor to the bundle's
 * hot path. Lifting pure predicates and tuning constants into a sibling
 * file makes them unit-testable in isolation, gives the next maintainer
 * one canonical place to discover them, and lets the conformance test
 * (`tests/unit/phenotype-contracts-conformance.test.ts`) stop vendoring
 * the value and import the production source instead.
 *
 * Public API (all side-effect-free):
 *   - PROVIDER_BREAKER_FAILURE_STATUSES: Set<number>
 *   - isProviderBreakerFailureStatus(status): boolean
 *   - PROVIDER_BREAKER_FAILURE_STATUSES_SORTED: readonly number[] (test/helpers)
 *   - shouldTripProviderBreakerForResult(result, isCombo, forceLiveComboTest): boolean  (PR-ε)
 *   - isAntigravityMissingProjectError(provider, result): boolean  (PR-ε)
 *
 * Internal helpers stay private (not re-exported) to avoid widening the
 * surface area beyond what the upstream consumer actually needs.
 *
 * Strategy note: this is a fork-only change per the Aug-2026 strategy
 * shift. The constant moves from `chat.ts:204` to this same constant
 * exported here. chat.ts continues to import the same value (now sourced
 * from this sibling file). No behavior change at runtime.
 *
 * PR-ε: port `shouldTripProviderBreakerForResult` and `isAntigravityMissingProjectError`
 * from upstream's chatPredicates.ts (release/v3.8.49) into our fork. Upstream's
 * upstream chatPredicates.ts has these as exports with PROPER guards attached.
 * Porting them gives us the same architectural intent + lets us add our own
 * tests for the guards (#7907/#7908 stream lifecycle, #8255 request scope).
 */

import { isLocalStreamLifecycleError } from "../../shared/utils/circuitBreaker";
import { isRequestScopedUpstreamFailure } from "./comboFailureLogging";

/**
 * HTTP status codes that should mark round-robin target semaphores as
 * cooling down and (optionally) trigger a provider circuit-breaker failure.
 *
 * Order of rationale (matches the contract `resilience-policy` schema):
 *  - 408: client-request timeout (request-side, but upstream is uncooperative)
 *  - 500: generic upstream crash
 *  - 502: bad gateway (downstream gateway got a bad response)
 *  - 503: service unavailable (overloaded or in maintenance)
 *  - 504: gateway timeout (downstream timed out)
 *
 * NOT included (documented architectural divergence):
 *  - 429: handled by the separate comboCooldownWait / providerCooldown
 *    layer (`src/lib/resilience/settings.ts`) rather than the breaker set.
 *  - 520/522/524/529: Cloudflare transient codes — OmniRoute does not
 *    currently include them in the breaker set. See
 *    `docs/contracts/README.md` for evaluation notes.
 */
export const PROVIDER_BREAKER_FAILURE_STATUSES = new Set<number>([
  408, 500, 502, 503, 504,
]);

/**
 * Pure predicate: should this status code trip a provider circuit-breaker
 * failure?
 *
 * Equivalent to `PROVIDER_BREAKER_FAILURE_STATUSES.has(status)` but
 * exposes a typed function so callers don't have to import the Set
 * directly. Useful for tests that want to mock the breaker decision.
 */
export function isProviderBreakerFailureStatus(status: number): boolean {
  return PROVIDER_BREAKER_FAILURE_STATUSES.has(status);
}

/**
 * Canonical sorted array form of PROVIDER_BREAKER_FAILURE_STATUSES.
 *
 * Used by tests that want to assert the exact set without depending on
 * Set iteration order. NOT consumed by the production code path — kept
 * here so the conformance test and the production source stay in lock-step.
 */
export const PROVIDER_BREAKER_FAILURE_STATUSES_SORTED: readonly number[] =
  [...PROVIDER_BREAKER_FAILURE_STATUSES].sort((a, b) => a - b);

// ─────────────────────────────────────────────────────────────────────────────
// PR-ε: ported from upstream's chatPredicates.ts (release/v3.8.49)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * #7907/#7908: single-model breaker trip bypasses the `isFailure` option (only applies
 * inside `breaker.execute()`), so it needs its own `isLocalStreamLifecycleError` guard —
 * otherwise a client abort (502 default, error='request_signal_aborted') trips the
 * provider-wide breaker. Pure predicate, unit-testable without the full request path.
 */
export function shouldTripProviderBreakerForResult(
  result: {
    status: number;
    errorCode?: string | null;
    errorType?: string | null;
    error?: unknown;
  },
  isCombo: boolean,
  forceLiveComboTest: boolean
): boolean {
  return (
    !forceLiveComboTest &&
    !isCombo &&
    !isRequestScopedUpstreamFailure({ code: result.errorCode, type: result.errorType }) &&
    !isLocalStreamLifecycleError(result.error) &&
    PROVIDER_BREAKER_FAILURE_STATUSES.has(Number(result.status))
  );
}

/**
 * Antigravity returns a 422 with a structured error code/type when the OAuth
 * project is missing (typically a tenant/admin issue). Tagging this as a
 * model-access error would route combo every which way; instead it's a
 * credential-scope problem and should propagate to the caller.
 */
export function isAntigravityMissingProjectError(
  provider: string,
  result: {
    status?: number;
    errorCode?: string;
    errorType?: string;
  }
): boolean {
  return (
    provider === "antigravity" &&
    result.status === 422 &&
    result.errorCode === "missing_project_id" &&
    result.errorType === "oauth_missing_project_id"
  );
}
