/**
 * Circuit Breaker — FASE-04 Observability & Resilience (v2.0)
 *
 * Implements the circuit breaker pattern with:
 * - States: CLOSED → DEGRADED → OPEN → HALF_OPEN → CLOSED
 * - Adaptive backoff: resetTimeout escalates on repeated open→probe→open cycles
 * - Failure-kind-aware thresholds: different limits per failure type
 * - Progressive degradation: high failure rate triggers warning before full open
 * - Transition history tracking for diagnostics
 * - DB persistence via domainState.js
 *
 * States:
 *   CLOSED    — Normal operation, requests pass through
 *   DEGRADED  — Failure rate elevated, requests pass through but warnings logged
 *   OPEN      — Requests are short-circuited
 *   HALF_OPEN — Probing: limited requests allowed to test recovery
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(tools/opossum-migration) — tracked in PR backlog (P2)
 *
 * Goal: collapse this file's `CircuitBreaker` class onto `opossum` (the de-facto
 * Node circuit breaker) while preserving custom semantics that opossum does
 * not model natively:
 *
 *   1. `DEGRADED` state — opossum models CLOSED / OPEN / HALF_OPEN only. The
 *      60%-of-failureThreshold DEGRADED warning state must remain a thin
 *      upstream wrapper that wraps a standard opossum breaker in observer mode,
 *      OR a sibling breaker ("DEGRADED tracker") that fires warnings and leaves
 *      the primary CLOSED state alone.
 *
 *   2. Per-kind thresholds (`kindThresholds`, `cooldownByKind`) — opossum has a
 *      single `errorFilterPercentage`. Per-kind thresholds are best implemented
 *      as a *dispatcher* that routes failure classified by `classifyError()`
 *      (see `src/shared/utils/classify429.ts`) to one of N child opossum
 *      breakers (e.g. `cb:rate_limit`, `cb:transient`, `cb:quota`), with the
 *      primary breaker deriving its state from `max(children.states)`.
 *
 *   3. Adaptive backoff escalation (`openCycleCount`, `maxBackoffMultiplier`) —
 *      opossum supports `timeout` / `resetTimeout` per breaker. Escalation can
 *      be implemented by mutating `resetTimeout` on `open` event listeners, but
 *      persistence across restarts (currently via `domainState.ts`) requires
 *      serializing the escalation factor.
 *
 *   4. DB persistence (`saveCircuitBreakerState`, `loadCircuitBreakerState`) —
 *      opossum does not persist. The persistence layer must remain a thin
 *      wrapper that snapshots `{ state, failureCount, lastFailureTime,
 *      openCycleCount, kindFailureCounts }` on every transition.
 *
 *   5. Registry (`getCircuitBreaker`, `getAllCircuitBreakerStatuses`,
 *      `resetAllCircuitBreakers`, periodic sweep in
 *      `src/shared/utils/circuitBreaker.ts:485`) — opossum has no built-in
 *      registry. Maintain our existing `Map<name, CircuitBreaker>`. Cap at
 *      `MAX_REGISTRY_SIZE = 500` and cold-evict as today.
 *
 *   6. `CircuitBreakerOpenError` — opossum throws on `fire()` while open, but
 *      the error type / retry-after metadata differ. Keep our error class as
 *      the public surface; translate from opossum's `EOPENBREAKER` rejection.
 *
 *   7. `isLocalStreamLifecycleError` helper (line 39 below) — independent of
 *      the breaker class. Keep as-is, but wire as opossum's `errorFilter`
 *      option.
 *
 * Migration shape (proposed):
 *
 *   class OpossumBreaker {
 *     private primary: opossum;
 *     private degraded: DegradationTracker;
 *     private children: Map<FailureKind, opossum>;
 *     private persistence: BreakerPersistence;
 *     ...
 *     async execute<T>(fn: () => Promise<T>): Promise<T> {
 *       this.degraded.observe();
 *       return this.primary.fire(fn);
 *     }
 *   }
 *
 * Rollout plan: dual-run for 14 days. Shadow opossum alongside the existing
 * implementation, compare `getStatus().state` after every transition, log
 * divergences, then flip on a date stamp.
 *
 * Risk: 41 consumer files reference `CircuitBreaker` / `getCircuitBreaker`
 * (incl. MCP tools, dashboard widgets, db/domainState.ts schema). Migration
 * must preserve public class names + `getCircuitBreaker(name, opts)` +
 * `getAllCircuitBreakerStatuses()` + `resetAllCircuitBreakers()` signatures.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  saveCircuitBreakerState,
  loadCircuitBreakerState,
  loadAllCircuitBreakerStates,
  deleteCircuitBreakerState,
  deleteAllCircuitBreakerStates,
} from "../../lib/db/domainState";
import type { FailureKind } from "./classify429";
import CircuitBreakerOpossum from "opossum";

/**
 * #4602 — Detect a LOCAL stream-lifecycle error that must NOT count as a
 * whole-provider failure. The Codex WebSocket→SSE bridge can throw a bare
 * `Invalid state: Controller is already closed` (an enqueue-after-close on our
 * own ReadableStream controller). It carries no `statusCode`, so it defaults to
 * HTTP 502 and would otherwise trip the provider circuit breaker — blacklisting
 * the entire Codex provider for a bug that lives in our bridge, not upstream.
 * Use this with the breaker's `isFailure` option so the bridge error is ignored
 * by the provider breaker while genuine upstream 5xx failures still count.
 */
export function isLocalStreamLifecycleError(error: unknown): boolean {
  if (!error) return false;
  const message =
    typeof error === "string"
      ? error
      : typeof (error as { message?: unknown }).message === "string"
        ? ((error as { message: string }).message as string)
        : "";
  if (!message) return false;
  return /controller is already closed/i.test(message);
}

export const STATE = {
  CLOSED: "CLOSED",
  DEGRADED: "DEGRADED",
  OPEN: "OPEN",
  HALF_OPEN: "HALF_OPEN",
} as const;

type CircuitState = (typeof STATE)[keyof typeof STATE];

/** Per-failure-kind threshold overrides */
interface FailureKindThresholds {
  /** Max failures of this kind before escalating to next state */
  threshold: number;
  /** Cooldown override for this failure kind */
  cooldown?: number;
  /** Whether this failure kind should trigger immediate OPEN (skip DEGRADED) */
  immediateOpen?: boolean;
}

interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;
  halfOpenRequests?: number;
  onStateChange?: ((name: string, oldState: string, newState: string) => void) | null;
  isFailure?: (error: unknown) => boolean;
  cooldownByKind?: Partial<Record<FailureKind, number>>;
  classifyError?: (error: unknown) => FailureKind | undefined;
  /**
   * Per-failure-kind thresholds.
   * When set, different failure types have different limits.
   */
  kindThresholds?: Partial<Record<FailureKind, Partial<FailureKindThresholds>>>;
  /**
   * Degradation threshold — failure count at which state becomes DEGRADED.
   * Default: 60% of failureThreshold.
   */
  degradationThreshold?: number;
  /**
   * Max backoff multiplier (exponential). Default: 16x resetTimeout.
   */
  maxBackoffMultiplier?: number;
  /**
   * How many open→half_open→open cycles before escalating backoff.
   * Default: 3.
   */
  backoffEscalationCount?: number;
}

interface TransitionRecord {
  from: string;
  to: string;
  timestamp: number;
  failureCount: number;
  reason?: string;
}

export class CircuitBreaker {
  name: string;
  failureThreshold: number;
  resetTimeout: number;
  halfOpenRequests: number;
  onStateChange: ((name: string, oldState: string, newState: string) => void) | null;
  isFailure: (error: unknown) => boolean;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  halfOpenAllowed: number;
  cooldownByKind: Partial<Record<FailureKind, number>>;
  classifyError: ((error: unknown) => FailureKind | undefined) | null;
  lastFailureKind: FailureKind | null;
  kindThresholds: Partial<Record<FailureKind, Partial<FailureKindThresholds>>>;
  degradationThreshold: number;
  maxBackoffMultiplier: number;
  backoffEscalationCount: number;

  /** Track failure counts per kind separately */
  kindFailureCounts: Record<string, number>;
  /** How many times has the breaker gone from OPEN → HALF_OPEN → OPEN */
  openCycleCount: number;
  /** State transition history */
  transitionHistory: TransitionRecord[];
  /** Max transition history entries */
  maxTransitionHistory: number;

  constructor(name: string, options: CircuitBreakerOptions = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeout = options.resetTimeout ?? 30000;
    this.halfOpenRequests = options.halfOpenRequests ?? 1;
    this.onStateChange = options.onStateChange || null;
    this.isFailure = options.isFailure || (() => true);

    this.state = STATE.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.halfOpenAllowed = 0;
    this.cooldownByKind = options.cooldownByKind ?? {};
    this.classifyError = options.classifyError ?? null;
    this.lastFailureKind = null;
    this.kindThresholds = options.kindThresholds ?? {};
    this.degradationThreshold =
      options.degradationThreshold ?? Math.ceil((this.failureThreshold * 60) / 100);
    this.maxBackoffMultiplier = options.maxBackoffMultiplier ?? 16;
    this.backoffEscalationCount = options.backoffEscalationCount ?? 3;

    this.kindFailureCounts = {};
    this.openCycleCount = 0;
    this.transitionHistory = [];
    this.maxTransitionHistory = 20;

    this._restoreFromDb();
  }

  _restoreFromDb() {
    try {
      const saved = loadCircuitBreakerState(this.name);
      if (saved) {
        if (
          saved.state === STATE.CLOSED ||
          saved.state === STATE.DEGRADED ||
          saved.state === STATE.OPEN ||
          saved.state === STATE.HALF_OPEN
        ) {
          this.state = saved.state;
        }
        this.failureCount = saved.failureCount;
        this.lastFailureTime = saved.lastFailureTime;
        const savedKind = saved.options?.lastFailureKind;
        if (
          savedKind === "rate_limit" ||
          savedKind === "quota_exhausted" ||
          savedKind === "transient"
        ) {
          this.lastFailureKind = savedKind;
        }
        this.openCycleCount = (saved.options?.openCycleCount as number) ?? 0;
        this.kindFailureCounts = (saved.options?.kindFailureCounts as Record<string, number>) ?? {};

        if (this.state === STATE.HALF_OPEN) {
          this.halfOpenAllowed = this.halfOpenRequests;
        }
      }
    } catch {
      // DB may not be ready yet (build phase)
    }
  }

  _persistToDb() {
    try {
      saveCircuitBreakerState(this.name, {
        state: this.state,
        failureCount: this.failureCount,
        lastFailureTime: this.lastFailureTime,
        options: {
          failureThreshold: this.failureThreshold,
          resetTimeout: this.resetTimeout,
          halfOpenRequests: this.halfOpenRequests,
          lastFailureKind: this.lastFailureKind,
          openCycleCount: this.openCycleCount,
          kindFailureCounts: this.kindFailureCounts,
        },
      });
    } catch {
      // Non-critical
    }
  }

  /**
   * Get the effective reset timeout, escalated by open cycle count.
   * Each open→half_open→open cycle multiplies the timeout.
   */
  _effectiveResetTimeout(): number {
    if (this.openCycleCount <= this.backoffEscalationCount) {
      return this.resetTimeout;
    }
    const escalationFactor = Math.pow(2, this.openCycleCount - this.backoffEscalationCount);
    return Math.min(
      this.resetTimeout * escalationFactor,
      this.resetTimeout * this.maxBackoffMultiplier
    );
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this._refreshOpenState();

    if (this.state === STATE.OPEN) {
      throw new CircuitBreakerOpenError(
        `Circuit breaker "${this.name}" is OPEN. Try again later.`,
        this.name,
        this._timeUntilReset()
      );
    }

    if (this.state === STATE.HALF_OPEN && this.halfOpenAllowed <= 0) {
      throw new CircuitBreakerOpenError(
        `Circuit breaker "${this.name}" is HALF_OPEN, no more probe requests allowed.`,
        this.name,
        this._timeUntilReset()
      );
    }

    if (this.state === STATE.HALF_OPEN) {
      this.halfOpenAllowed--;
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (error) {
      if (this.isFailure(error)) {
        let kind: FailureKind | undefined;
        if (this.classifyError) {
          try {
            kind = this.classifyError(error);
          } catch {
            kind = undefined;
          }
        }
        this._onFailure(kind);
      }
      throw error;
    }
  }

  canExecute() {
    this._refreshOpenState();
    if (this.state === STATE.CLOSED || this.state === STATE.DEGRADED) return true;
    if (this.state === STATE.OPEN) return false;
    if (this.state === STATE.HALF_OPEN) return this.halfOpenAllowed > 0;
    return false;
  }

  getStatus() {
    this._refreshOpenState();
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      retryAfterMs: this.getRetryAfterMs(),
      lastFailureKind: this.lastFailureKind,
      openCycleCount: this.openCycleCount,
      kindFailureCounts: { ...this.kindFailureCounts },
      degradationThreshold: this.degradationThreshold,
      effectiveResetTimeout: this._effectiveResetTimeout(),
    };
  }

  getRetryAfterMs() {
    this._refreshOpenState();
    if (this.state === STATE.CLOSED || this.state === STATE.DEGRADED) return 0;
    return this._timeUntilReset();
  }

  reset() {
    this._transition(STATE.CLOSED, "manual-reset");
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.lastFailureKind = null;
    this.openCycleCount = 0;
    this.kindFailureCounts = {};
    this._persistToDb();
  }

  // ─── Internal ─────────────────────────────────

  _onSuccess() {
    if (this.state === STATE.OPEN) {
      this._transition(STATE.CLOSED, "success-recovery");
      this.failureCount = 0;
      this.successCount = 0;
      this.lastFailureTime = null;
      this.lastFailureKind = null;
      this.openCycleCount = 0;
      this.kindFailureCounts = {};
    } else if (this.state === STATE.HALF_OPEN) {
      this.successCount++;
      this._transition(STATE.CLOSED, "probe-success");
      this.failureCount = 0;
      this.lastFailureKind = null;
      this.openCycleCount = 0;
      this.kindFailureCounts = {};
    } else {
      // CLOSED or DEGRADED: reset counts
      this.failureCount = Math.max(0, this.failureCount - 1); // gradual recovery
      if (this.state === STATE.DEGRADED && this.failureCount <= this.degradationThreshold) {
        this._transition(STATE.CLOSED, "recovery");
      }
    }
    this._persistToDb();
  }

  _onFailure(kind?: FailureKind | null) {
    const failureKind = kind ?? null;
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.lastFailureKind = failureKind;

    // Track per-kind failure counts
    if (failureKind) {
      this.kindFailureCounts[failureKind] = (this.kindFailureCounts[failureKind] || 0) + 1;
    }

    // Check kind-specific thresholds
    if (failureKind) {
      const kindConfig = this.kindThresholds[failureKind];
      if (kindConfig) {
        const kindCount = this.kindFailureCounts[failureKind] || 0;

        // Immediate open for critical failure kinds
        if (kindConfig.immediateOpen && kindCount >= (kindConfig.threshold || 1)) {
          this._openCircuit(failureKind);
          return;
        }

        // Kind-specific threshold reached
        if (kindCount >= (kindConfig.threshold || this.failureThreshold)) {
          this._openCircuit(failureKind);
          return;
        }
      }
    }

    // State transitions based on total failure count
    if (this.state === STATE.OPEN) {
      // Already OPEN — just update persistence
    } else if (this.state === STATE.HALF_OPEN) {
      // Probe failed: OPEN with cycle count escalation
      this.openCycleCount++;
      this._transition(STATE.OPEN, `probe-failed (cycle ${this.openCycleCount})`);
    } else if (this.state === STATE.DEGRADED) {
      // Degraded → Open when threshold reached
      if (this.failureCount >= this.failureThreshold) {
        this._openCircuit(failureKind);
      }
    } else {
      // CLOSED → DEGRADED or OPEN
      if (this.failureCount >= this.failureThreshold) {
        this._openCircuit(failureKind);
      } else if (this.failureCount >= this.degradationThreshold) {
        this._transition(
          STATE.DEGRADED,
          `elevated-failures (${this.failureCount}/${this.failureThreshold})`
        );
      }
    }
    this._persistToDb();
  }

  _openCircuit(kind: FailureKind | null) {
    this._transition(STATE.OPEN, kind ? `kind:${kind}` : undefined);
  }

  _shouldAttemptReset() {
    if (!this.lastFailureTime) return true;
    const cooldown = this._effectiveCooldown();
    return Date.now() - this.lastFailureTime >= cooldown;
  }

  _effectiveCooldown() {
    const baseTimeout = this._effectiveResetTimeout();
    if (this.lastFailureKind !== null) {
      const override = this.cooldownByKind[this.lastFailureKind];
      if (typeof override === "number" && Number.isFinite(override) && override >= 0) {
        return override;
      }
    }
    return baseTimeout;
  }

  _timeUntilReset() {
    if (!this.lastFailureTime) return 0;
    const cooldown = this._effectiveCooldown();
    return Math.max(0, cooldown - (Date.now() - this.lastFailureTime));
  }

  _refreshOpenState() {
    if (this.state === STATE.OPEN && this._shouldAttemptReset()) {
      this._transition(STATE.HALF_OPEN, "timeout-elapsed");
      this._persistToDb();
    }
  }

  _transition(newState: CircuitState, reason?: string) {
    const oldState = this.state;
    this.state = newState;

    if (newState === STATE.HALF_OPEN) {
      this.halfOpenAllowed = this.halfOpenRequests;
    }

    // Record transition
    this.transitionHistory.push({
      from: oldState,
      to: newState,
      timestamp: Date.now(),
      failureCount: this.failureCount,
      reason,
    });
    if (this.transitionHistory.length > this.maxTransitionHistory) {
      this.transitionHistory.shift();
    }

    if (this.onStateChange && oldState !== newState) {
      this.onStateChange(this.name, oldState, newState);
    }
  }
}

export class CircuitBreakerOpenError extends Error {
  circuitName: string;
  retryAfterMs: number;

  constructor(message: string, circuitName: string, retryAfterMs: number) {
    super(message);
    this.name = "CircuitBreakerOpenError";
    this.circuitName = circuitName;
    this.retryAfterMs = retryAfterMs;
  }
}

// ─── Registry ─────────────────────────────────────

const MAX_REGISTRY_SIZE = 500;
const registry = new Map<string, CircuitBreaker>();

/** Test-only: current number of registered circuit breakers. */
export function __getCircuitRegistrySizeForTests(): number {
  return registry.size;
}

const _registrySweep = setInterval(() => {
  const now = Date.now();
  for (const [name, breaker] of registry) {
    const status = breaker.getStatus();
    if (
      status.state === STATE.CLOSED &&
      status.failureCount === 0 &&
      (!status.lastFailureTime || now - status.lastFailureTime > 30 * 60 * 1000)
    ) {
      registry.delete(name);
      try {
        deleteCircuitBreakerState(name);
      } catch {}
    }
  }
}, 5 * 60_000);
if (typeof _registrySweep === "object" && "unref" in _registrySweep) {
  (_registrySweep as { unref?: () => void }).unref?.();
}

/**
 * Enforce MAX_REGISTRY_SIZE before inserting a new breaker. The cap was previously declared
 * but never used — the only bound was the 5-min sweep, which evicts a breaker only if it is
 * CLOSED, has zero failures, AND has been idle for >30 min. With high-cardinality breaker
 * names that cap could be exceeded for up to 30 min. Evict idle CLOSED breakers (oldest first)
 * to make room; never evict OPEN/HALF_OPEN breakers, since those carry meaningful state. A
 * CLOSED breaker with zero failures is behaviorally identical to a freshly-created one, so
 * evicting and lazily recreating it later changes nothing.
 */
function evictColdBreakersIfNeeded(): void {
  if (registry.size < MAX_REGISTRY_SIZE) return;
  const candidates: { name: string; lastFailureTime: number }[] = [];
  for (const [name, breaker] of registry) {
    const status = breaker.getStatus();
    if (status.state === STATE.CLOSED && status.failureCount === 0) {
      candidates.push({ name, lastFailureTime: status.lastFailureTime || 0 });
    }
  }
  candidates.sort((a, b) => a.lastFailureTime - b.lastFailureTime);
  const target = registry.size - MAX_REGISTRY_SIZE + 1;
  for (let i = 0; i < candidates.length && i < target; i++) {
    registry.delete(candidates[i].name);
    try {
      deleteCircuitBreakerState(candidates[i].name);
    } catch {}
  }
}

export function getCircuitBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
  if (!registry.has(name)) {
    evictColdBreakersIfNeeded();
    registry.set(name, new CircuitBreaker(name, options));
  }
  const breaker = registry.get(name)!;
  if (options) {
    if (typeof options.failureThreshold === "number") {
      breaker.failureThreshold = options.failureThreshold;
    }
    if (typeof options.resetTimeout === "number") {
      breaker.resetTimeout = options.resetTimeout;
    }
    if (typeof options.halfOpenRequests === "number") {
      breaker.halfOpenRequests = options.halfOpenRequests;
      if (breaker.state === STATE.HALF_OPEN) {
        breaker.halfOpenAllowed = Math.min(breaker.halfOpenAllowed, breaker.halfOpenRequests);
      }
    }
    if (typeof options.onStateChange === "function") {
      breaker.onStateChange = options.onStateChange;
    }
    if (typeof options.isFailure === "function") {
      breaker.isFailure = options.isFailure;
    }
    if (options.cooldownByKind) {
      breaker.cooldownByKind = {
        ...breaker.cooldownByKind,
        ...options.cooldownByKind,
      };
    }
    if (typeof options.classifyError === "function") {
      breaker.classifyError = options.classifyError;
    }
    if (options.kindThresholds) {
      breaker.kindThresholds = {
        ...breaker.kindThresholds,
        ...options.kindThresholds,
      };
    }
    if (typeof options.degradationThreshold === "number") {
      breaker.degradationThreshold = options.degradationThreshold;
    }
    if (typeof options.maxBackoffMultiplier === "number") {
      breaker.maxBackoffMultiplier = options.maxBackoffMultiplier;
    }
    if (typeof options.backoffEscalationCount === "number") {
      breaker.backoffEscalationCount = options.backoffEscalationCount;
    }
    breaker._persistToDb();
  }
  return breaker;
}

export function getAllCircuitBreakerStatuses() {
  try {
    const persisted = loadAllCircuitBreakerStates();
    for (const cb of persisted) {
      if (!registry.has(cb.name)) {
        getCircuitBreaker(cb.name);
      }
    }
  } catch {
    // Use registry only
  }
  return Array.from(registry.values()).map((cb) => cb.getStatus());
}

export function resetAllCircuitBreakers() {
  for (const cb of registry.values()) {
    cb.reset();
  }
  registry.clear();
  try {
    deleteAllCircuitBreakerStates();
  } catch {
    // Non-critical
  }
}

// ─── Opossum shadow adapter (migration step 1) ──────────────────────────────
//
// Feature flag: `CIRCUIT_BREAKER_OPOSSUM_SHADOW=1` enables passive dual-run of
// an `opossum` circuit breaker alongside the hand-rolled primary. The shadow
// does NOT short-circuit requests; it only observes state transitions and logs
// divergences. After 14 days of clean divergence (or near-zero divergence)
// this can be promoted to the primary backend.
//
// The shadow exposes the same (failureThreshold, resetTimeout, errorFilter)
// surface that the migration plan at lines 19–85 describes; DEGRADED state is
// folded to CLOSED in the shadow (opossum has no DEGRADED), and the divergence
// detector compares only the 3 core states (CLOSED / OPEN / HALF_OPEN).
//
// See `tests/unit/shared/utils/opossum-shadow.test.ts` for behavior contract.

export interface OpossumShadowStats {
  readonly enabled: boolean;
  readonly fires: number;
  readonly divergences: number;
  readonly opossumOpens: number;
  readonly primaryOpens: number;
}

const shadowStatsInternal = {
  enabled: process.env.CIRCUIT_BREAKER_OPOSSUM_SHADOW === "1",
  fires: 0,
  divergences: 0,
  opossumOpens: 0,
  primaryOpens: 0,
};

/** Test-only: read the live opossum-shadow telemetry counters. */
export function __getOpossumShadowStatsForTests(): OpossumShadowStats {
  return { ...shadowStatsInternal };
}

/** Test-only: reset the opossum-shadow telemetry counters. */
export function __resetOpossumShadowStatsForTests(): void {
  shadowStatsInternal.fires = 0;
  shadowStatsInternal.divergences = 0;
  shadowStatsInternal.opossumOpens = 0;
  shadowStatsInternal.primaryOpens = 0;
}

function mapOpossumState(opossum: CircuitBreakerOpossum): "CLOSED" | "OPEN" | "HALF_OPEN" {
  // opossum 10.x exposes `.opened` and `.halfOpen` boolean flags. Compose to
  // a string for divergence comparison. (`.closed` is the default.)
  if (opossum.opened) return "OPEN";
  if (opossum.halfOpen) return "HALF_OPEN";
  return "CLOSED";
}

function foldPrimaryStateToCore(
  state: CircuitState
): "CLOSED" | "OPEN" | "HALF_OPEN" {
  // DEGRADED is unique to the hand-rolled breaker; for divergence comparison
  // it folds into CLOSED (the breaker is still serving traffic).
  if (state === STATE.DEGRADED) return "CLOSED";
  return state as "CLOSED" | "OPEN" | "HALF_OPEN";
}

/**
 * Run `fn` through a fresh opossum breaker built from the primary's
 * current threshold configuration. Records state-transition divergences
 * for telemetry. NEVER short-circuits the call — opossum's `fire()` is
 * used here only to drive opossum's internal state machine, and the
 * primary breaker still owns the request semantics.
 */
export async function runOpossumShadow<T>(
  primary: CircuitBreaker,
  fn: () => Promise<T>
): Promise<T> {
  if (!shadowStatsInternal.enabled) {
    return fn();
  }

  // Snapshot primary thresholds at call time; opossum mirrors them.
  const errorThresholdPercentage =
    primary.failureThreshold > 0
      ? Math.max(1, Math.floor((100 * 1) / primary.failureThreshold))
      : 50;
  const opossumBreaker = new CircuitBreakerOpossum(fn, {
    name: `shadow:${primary.name}`,
    timeout: 30_000,
    errorThresholdPercentage,
    resetTimeout: primary.resetTimeout,
    errorFilter: (err: unknown) =>
      primary.isFailure ? !primary.isFailure(err) : false,
    rollingCountTimeout: 10_000,
    rollingCountBuckets: 10,
    volumeThreshold: Math.max(1, Math.floor(primary.failureThreshold / 2)),
  });

  const previousOpossumState = mapOpossumState(opossumBreaker);
  const previousPrimaryState = foldPrimaryStateToCore(primary.state);

  try {
    const result = await opossumBreaker.fire();
    shadowStatsInternal.fires++;
    const opossumState = mapOpossumState(opossumBreaker);
    const primaryState = foldPrimaryStateToCore(primary.state);
    if (opossumState !== previousOpossumState) {
      if (opossumState === "OPEN") shadowStatsInternal.opossumOpens++;
    }
    if (
      opossumState !== primaryState &&
      // Ignore transient single-fire disagreements — only count material
      // divergence (one breaker open, the other closed for >0 fires).
      shadowStatsInternal.fires > 1
    ) {
      shadowStatsInternal.divergences++;
      // Lightweight stderr log; pino can subscribe via a future PR.
      if (process.env.CIRCUIT_BREAKER_OPOSSUM_SHADOW_VERBOSE === "1") {
        process.stderr.write(
          `[opossum-shadow] divergence on "${primary.name}": ` +
            `opossum=${opossumState} primary=${primaryState}\n`
        );
      }
    }
    return result;
  } catch (err) {
    shadowStatsInternal.fires++;
    const opossumState = mapOpossumState(opossumBreaker);
    if (opossumState === "OPEN") shadowStatsInternal.opossumOpens++;
    if (opossumState !== foldPrimaryStateToCore(primary.state) && shadowStatsInternal.fires > 1) {
      shadowStatsInternal.divergences++;
      if (process.env.CIRCUIT_BREAKER_OPOSSUM_SHADOW_VERBOSE === "1") {
        process.stderr.write(
          `[opossum-shadow] divergence (on error) on "${primary.name}": ` +
            `opossum=${opossumState} primary=${primary.state}\n`
        );
      }
    }
    throw err;
  } finally {
    // No-op: each shadow invocation uses a short-lived breaker to avoid
    // leaking opossum state across requests. A future iteration can pool
    // shadows per `primary.name` if memory becomes a concern.
    void previousPrimaryState;
  }
}

// ─── Per-kind child breaker persistence ──────────────────────────────────────

/**
 * Build a namespaced child state name for DB persistence.
 * Uses the convention `{primaryName}#child:{kind}` to scope child states
 * under the primary breaker in the `domain_circuit_breakers` table.
 */
function childStateDbName(primaryName: string, kind: FailureKind): string {
  return `${primaryName}#child:${kind}`;
}

/** Persist a child breaker's state using the existing domainState table. */
export function saveChildBreakerState(
  primaryName: string,
  kind: FailureKind,
  state: { state: string; failureCount: number; lastFailureTime: number | null },
): void {
  saveCircuitBreakerState(childStateDbName(primaryName, kind), {
    state: state.state,
    failureCount: state.failureCount,
    lastFailureTime: state.lastFailureTime,
    options: { kind, primaryName },
  });
}

/** Load a child breaker's state from the DB. Returns null when absent. */
export function loadChildBreakerState(
  primaryName: string,
  kind: FailureKind,
): { state: string; failureCount: number; lastFailureTime: number | null } | null {
  const raw = loadCircuitBreakerState(childStateDbName(primaryName, kind));
  if (!raw) return null;
  return {
    state: raw.state,
    failureCount: raw.failureCount,
    lastFailureTime: raw.lastFailureTime,
  };
}

/** Delete all child breaker states scoped to a given primary breaker. */
export function deleteChildBreakerStates(primaryName: string): void {
  try {
    const all = loadAllCircuitBreakerStates();
    const prefix = `${primaryName}#child:`;
    for (const record of all) {
      if (record.name.startsWith(prefix)) {
        deleteCircuitBreakerState(record.name);
      }
    }
  } catch {
    // Non-critical
  }
}

// ─── Per-FailureKind child breaker snapshot ──────────────────────────────────

export interface ChildBreakerSnapshot {
  kind: FailureKind;
  opossumState: "CLOSED" | "OPEN" | "HALF_OPEN";
  stats: {
    failures: number;
    successes: number;
    rejects: number;
    fires: number;
    timeouts: number;
  };
}

function createChildBreakerAction(kind: FailureKind) {
  return (shouldFail: boolean) => {
    if (shouldFail) {
      return Promise.reject(new Error(`child-breaker:${kind}`));
    }
    return Promise.resolve(undefined as unknown as "child-breaker:kind:success");
  };
}

function childErrorThreshold(primaryThreshold: number): number {
  if (primaryThreshold <= 0) return 50;
  return Math.max(1, Math.floor((100 * 1) / primaryThreshold));
}

function childVolumeThreshold(primaryThreshold: number): number {
  return Math.max(1, Math.floor(primaryThreshold / 2));
}

/**
 * Aggregate child breaker states into a single severity level.
 *
 * Severity (ascending): CLOSED < DEGRADED < HALF_OPEN < OPEN.
 * - Any child OPEN → OPEN
 * - Any child HALF_OPEN (and none OPEN) → HALF_OPEN
 * - Total child failures >= degradationThreshold → DEGRADED
 * - Otherwise → CLOSED
 */
function aggregateChildStates(
  children: Map<FailureKind, CircuitBreakerOpossum>,
  degradationThreshold: number,
): "CLOSED" | "DEGRADED" | "OPEN" | "HALF_OPEN" {
  let anyOpen = false;
  let anyHalfOpen = false;
  let totalFailures = 0;

  for (const child of children.values()) {
    if ((child as unknown as { opened: boolean }).opened) anyOpen = true;
    if ((child as unknown as { halfOpen: boolean }).halfOpen) anyHalfOpen = true;
    const s = (child as unknown as { stats: { failures: number } }).stats;
    totalFailures += s?.failures ?? 0;
  }

  if (anyOpen) return "OPEN";
  if (anyHalfOpen) return "HALF_OPEN";
  if (totalFailures >= degradationThreshold) return "DEGRADED";
  return "CLOSED";
}

/**
 * Manages per-{@link FailureKind} child opossum circuit breakers alongside a
 * primary hand-rolled {@link CircuitBreaker}. Each child independently tracks
 * failures of one kind; the primary's state can be derived as the max across
 * children via {@link getAggregatedState}.
 *
 * Child breakers use a dummy "driver" action — callers invoke
 * {@link recordOutcome} with a kind and success/failure, and the helper fires
 * the child's action with the appropriate signal to drive opossum's rolling
 * stats and state machine.
 *
 * Persistence follows the `domainState.ts` pattern: child states persist as
 * `{primaryName}#child:{kind}` rows in the `domain_circuit_breakers` table
 * and are restored on construction when `persistence` is enabled.
 */
export class CircuitBreakerOpossumFactory {
  readonly primary: CircuitBreaker;
  private children: Map<FailureKind, CircuitBreakerOpossum>;
  private opts: { persistence: boolean };

  constructor(
    primary: CircuitBreaker,
    options?: { persistence?: boolean },
  ) {
    this.primary = primary;
    this.opts = { persistence: options?.persistence ?? true };
    this.children = new Map();
    this._initialize();
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Record an outcome (success/failure) through the child breaker for the
   * given kind. Drives the opossum state machine so the child opens/closes
   * based on its own rolling failure window.
   */
  async recordOutcome(kind: FailureKind, isSuccess: boolean): Promise<void> {
    const child = this.children.get(kind);
    if (!child) return;
    try {
      await (child as unknown as { fire: (...args: unknown[]) => Promise<unknown> }).fire(!isSuccess);
    } catch {
      // Expected — fire() rejects on timeout / open-circuit or
      // when the dummy action itself rejects (simulated failure).
    }
  }

  /**
   * Return the aggregated state across all child breakers.
   *
   * Severity order (ascending):
   * CLOSED < DEGRADED < HALF_OPEN < OPEN
   */
  getAggregatedState(): "CLOSED" | "DEGRADED" | "OPEN" | "HALF_OPEN" {
    return aggregateChildStates(this.children, this.primary.degradationThreshold);
  }

  /** Get snapshots of all child breakers. */
  getChildSnapshots(): ChildBreakerSnapshot[] {
    const snapshots: ChildBreakerSnapshot[] = [];
    for (const [kind, child] of this.children) {
      const c = child as unknown as {
        opened: boolean;
        halfOpen: boolean;
        stats: {
          failures: number;
          successes: number;
          rejects: number;
          fires: number;
          timeouts: number;
        };
      };
      snapshots.push({
        kind,
        opossumState: c.opened ? "OPEN" : c.halfOpen ? "HALF_OPEN" : "CLOSED",
        stats: {
          failures: c.stats?.failures ?? 0,
          successes: c.stats?.successes ?? 0,
          rejects: c.stats?.rejects ?? 0,
          fires: c.stats?.fires ?? 0,
          timeouts: c.stats?.timeouts ?? 0,
        },
      });
    }
    return snapshots;
  }

  /** Get a single child breaker, or `undefined` if no child for this kind. */
  getChild(kind: FailureKind): CircuitBreakerOpossum | undefined {
    return this.children.get(kind);
  }

  /** Reset all child breakers to CLOSED and delete their persisted states. */
  reset(): void {
    for (const child of this.children.values()) {
      (child as unknown as { close: () => void }).close();
    }
    if (this.opts.persistence) {
      deleteChildBreakerStates(this.primary.name);
    }
  }

  /** Return the number of child breakers managed. */
  get size(): number {
    return this.children.size;
  }

  /** Iterable over all managed child breakers. */
  *[Symbol.iterator](): IterableIterator<[FailureKind, CircuitBreakerOpossum]> {
    yield* this.children.entries();
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private _initialize(): void {
    for (const kind of ["rate_limit", "quota_exhausted", "transient"] as FailureKind[]) {
      this._createChild(kind);
    }
    if (this.opts.persistence) {
      this._restoreFromDb();
    }
  }

  private _createChild(kind: FailureKind): void {
    const childName = childStateDbName(this.primary.name, kind);
    const child = new CircuitBreakerOpossum(createChildBreakerAction(kind), {
      name: childName,
      timeout: false,
      errorThresholdPercentage: childErrorThreshold(this.primary.failureThreshold),
      resetTimeout: this.primary.resetTimeout,
      rollingCountTimeout: 10_000,
      rollingCountBuckets: 10,
      volumeThreshold: childVolumeThreshold(this.primary.failureThreshold),
      enabled: true,
    });

    // Persist on every state transition when enabled.
    if (this.opts.persistence) {
      const c = child as unknown as { on: (event: string, handler: () => void) => void };
      c.on("open", () => {
        try {
          saveChildBreakerState(this.primary.name, kind, {
            state: "OPEN",
            failureCount: (child as unknown as { stats: { failures: number } }).stats?.failures ?? 0,
            lastFailureTime: Date.now(),
          });
        } catch {
          // Non-critical — persistence is best-effort
        }
      });
      c.on("close", () => {
        try {
          saveChildBreakerState(this.primary.name, kind, {
            state: "CLOSED",
            failureCount: (child as unknown as { stats: { failures: number } }).stats?.failures ?? 0,
            lastFailureTime: null,
          });
        } catch {
          // Non-critical — persistence is best-effort
        }
      });
      c.on("halfOpen", () => {
        try {
          saveChildBreakerState(this.primary.name, kind, {
            state: "HALF_OPEN",
            failureCount: (child as unknown as { stats: { failures: number } }).stats?.failures ?? 0,
            lastFailureTime: Date.now(),
          });
        } catch {
          // Non-critical — persistence is best-effort
        }
      });
    }

    this.children.set(kind, child);
  }

  private _restoreFromDb(): void {
    try {
      for (const kind of ["rate_limit", "quota_exhausted", "transient"] as FailureKind[]) {
        const saved = loadChildBreakerState(this.primary.name, kind);
        if (!saved) continue;
        const child = this.children.get(kind);
        if (!child) continue;
        if (saved.state === "OPEN") {
          (child as unknown as { open: () => void }).open();
        }
        // HALF_OPEN is transient — the timer would have expired so we
        // restore as CLOSED and let the next failure drive the state.
      }
    } catch {
      // DB not ready yet
    }
  }
}

// ─── Per-kind shadow telemetry (factory-aware) ──────────────────────────────

/**
 * Per-kind divergence entry tracked in the extended shadow telemetry.
 */
export interface PerKindDivergenceEntry {
  readonly kind: FailureKind;
  readonly divergences: number;
  readonly opossumOpens: number;
}

/**
 * Extended shadow stats including per-kind information.
 * Builds on the base {@link OpossumShadowStats} without modifying it.
 */
export interface OpossumShadowStatsV2 extends OpossumShadowStats {
  readonly perKind: Record<FailureKind, PerKindDivergenceEntry>;
}

const perKindStatsInternal: Record<
  FailureKind,
  { divergences: number; opossumOpens: number }
> = {
  rate_limit: { divergences: 0, opossumOpens: 0 },
  quota_exhausted: { divergences: 0, opossumOpens: 0 },
  transient: { divergences: 0, opossumOpens: 0 },
};

/** Test-only: read the factory-aware shadow telemetry. */
export function __getOpossumShadowStatsV2ForTests(): OpossumShadowStatsV2 {
  const base = __getOpossumShadowStatsForTests();
  return {
    ...base,
    perKind: {
      rate_limit: { ...perKindStatsInternal.rate_limit, kind: "rate_limit" },
      quota_exhausted: {
        ...perKindStatsInternal.quota_exhausted,
        kind: "quota_exhausted",
      },
      transient: { ...perKindStatsInternal.transient, kind: "transient" },
    },
  };
}

/** Test-only: reset the factory-aware shadow telemetry counters. */
export function __resetOpossumShadowStatsV2ForTests(): void {
  __resetOpossumShadowStatsForTests();
  perKindStatsInternal.rate_limit = { divergences: 0, opossumOpens: 0 };
  perKindStatsInternal.quota_exhausted = { divergences: 0, opossumOpens: 0 };
  perKindStatsInternal.transient = { divergences: 0, opossumOpens: 0 };
}

/**
 * Compute the "expected" primary state for a given failure kind based on
 * the primary breaker's `kindFailureCounts` and `kindThresholds`.
 *
 * Used by the factory-aware shadow to detect if the opossum child breaker
 * diverges from what the hand-rolled logic would produce.
 */
function expectedKindState(
  primary: CircuitBreaker,
  kind: FailureKind,
): "CLOSED" | "OPEN" {
  const kindCount = primary.kindFailureCounts[kind] ?? 0;
  const kindCfg = primary.kindThresholds[kind];
  const threshold = kindCfg?.threshold ?? primary.failureThreshold;
  if (kindCfg?.immediateOpen && kindCount >= threshold) return "OPEN";
  if (kindCount >= threshold) return "OPEN";
  return "CLOSED";
}

/**
 * Run `fn` through the primary breaker while simultaneously routing
 * outcomes through the factory's per-kind child breakers. Detects
 * per-kind state divergences and records them in the extended shadow
 * telemetry (`__getOpossumShadowStatsV2ForTests`).
 *
 * NEVER short-circuits — the factory is passive observer only, consistent
 * with the `runOpossumShadow()` contract.
 */
export async function runOpossumShadowFactory<T>(
  primary: CircuitBreaker,
  factory: CircuitBreakerOpossumFactory,
  fn: () => Promise<T>,
  classifyError?: ((error: unknown) => FailureKind | undefined) | null,
): Promise<T> {
  if (!shadowStatsInternal.enabled) {
    return fn();
  }

  let kind: FailureKind | undefined;

  try {
    const result = await fn();
    shadowStatsInternal.fires++;

    // On success, record success through each child breaker to keep their
    // statistical windows aligned with the healthy state.
    for (const k of ["rate_limit", "quota_exhausted", "transient"] as FailureKind[]) {
      await factory.recordOutcome(k, true);
    }

    return result;
  } catch (error) {
    shadowStatsInternal.fires++;

    // Classify the error to determine which child breaker to drive.
    try {
      kind =
        classifyError?.(error) ??
        primary.classifyError?.(error) ??
        undefined;
    } catch {
      // If classifyError throws, skip per-kind tracking for this fire.
    }

    if (kind) {
      await factory.recordOutcome(kind, false);

      // Check per-kind divergence.
      const child = factory.getChild(kind);
      const childCasted = child as unknown as {
        opened: boolean;
        halfOpen: boolean;
      } | undefined;
      if (childCasted) {
        const childState = childCasted.opened
          ? "OPEN"
          : childCasted.halfOpen
            ? "HALF_OPEN"
            : "CLOSED";
        const expected = expectedKindState(primary, kind);

        if (childState === "OPEN" && expected !== "OPEN") {
          perKindStatsInternal[kind].divergences++;
        } else if (childState !== "OPEN" && expected === "OPEN") {
          perKindStatsInternal[kind].divergences++;
        }

        if (childState === "OPEN") {
          perKindStatsInternal[kind].opossumOpens++;
          shadowStatsInternal.opossumOpens++;
        }
      }
    }

    throw error;
  }
}
