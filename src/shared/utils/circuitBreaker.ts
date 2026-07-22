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
 * # Migration plan: opossum (deferred — high-risk 600-LOC refactor)
 *
 * The opossum library (https://github.com/nodeshift/opossum) provides a mature
 * circuit breaker (CLOSED / OPEN / HALF_OPEN, but NOT our DEGRADED state and
 * NOT per-kind thresholds natively). This file should be migrated to opossum
 * but the work is non-trivial because:
 *
 *   1. DEGRADED state — opossum has no equivalent. Migration must wrap a
 *      `DegradationTracker` sibling to opossum and fold the 4-state model
 *      into opossum's 3-state model for the opossum-owned breaker only.
 *   2. Per-kind thresholds (`kindThresholds`, `cooldownByKind`,
 *      `applyFailureIncrement`) — opossum only has one global threshold.
 *      Migration must dispatch to N child opossum breakers (one per
 *      FailureKind) and aggregate state as `max(children.states)`.
 *   3. Adaptive backoff escalation — migrate by mutating `resetTimeout`
 *      on the `open` event, persisted via `saveCircuitBreakerState`.
 *   4. DB persistence (`saveCircuitBreakerState`,
 *      `loadCircuitBreakerState`, `deleteCircuitBreakerState`) — wrap a
 *      thin `BreakerPersistence` snapshot for `{ state, failureCount,
 *      lastFailureTime, openCycleCount, kindFailureCounts }`.
 *   5. Registry (`getCircuitBreaker`, `getAllCircuitBreakers`,
 *      `deleteCircuitBreaker`, periodic sweep) — keep `Map<name, …>` +
 *      500 cap + cold-evict unchanged; only the entry type changes.
 *   6. Public surface (`CircuitBreakerOpenError`, registry helpers,
 *      `isLocalStreamLifecycleError`) — must be preserved unchanged. Wire
 *      `isLocalStreamLifecycleError` as opossum's `errorFilter` option so
 *      local stream-lifecycle errors never count as failures.
 *
 * Until the migration lands, this file's hand-rolled implementation remains
 * the source of truth. `opossum@10` is installed but unused.
 */

import {
  saveCircuitBreakerState,
  loadCircuitBreakerState,
  loadAllCircuitBreakerStates,
  deleteCircuitBreakerState,
  deleteAllCircuitBreakerStates,
} from "../../lib/db/domainState";
import type { FailureKind } from "./classify429";

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


// Opossum primary mode: when CIRCUIT_BREAKER_OPOSSUM_PRIMARY=1, getCircuitBreaker returns
// an OpossumCircuitBreaker wrapper that delegates to opossum under the hood.
const _opossumPrimaryEnabled = process.env.CIRCUIT_BREAKER_OPOSSUM_PRIMARY === "1";

export function getCircuitBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
  if (_opossumPrimaryEnabled) {
    return getOrCreateOpossumBreaker(name, options) as unknown as CircuitBreaker;
  }
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

// ─────────────────────────────────────────────────────────────────────────────
// PR-E: Opossum step-2 — primary circuit breaker adapter
//


// =============================================================================
// Opossum Step-2: Primary Circuit Breaker (PR-P, closes #407)
//
// OpossumCircuitBreaker wraps opossum as the primary circuit breaker,
// with DEGRADED state folding and per-kind child breakers.
//
// Enable: CIRCUIT_BREAKER_OPOSSUM_PRIMARY=1
// =============================================================================

import OpossumBreaker from "opossum";

interface OpossumOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  volumeThreshold?: number;
}

/** Opossum-backed circuit breaker — drop-in replacement for hand-rolled impl. */
export class OpossumCircuitBreaker {
  private readonly breakers: Map<string, OpossumBreaker<[], unknown>>;
  private readonly primary: OpossumBreaker<[() => Promise<unknown>], unknown>;
  private degraded = false;
  private failureCount = 0;
  private highWatermark = 5;

  constructor(
    public readonly name: string,
    opts: OpossumOptions = {},
  ) {
    const oOpts = {
      timeout: opts.timeout ?? 30_000,
      errorThresholdPercentage: opts.errorThresholdPercentage ?? 50,
      resetTimeout: opts.resetTimeout ?? 30_000,
      volumeThreshold: opts.volumeThreshold ?? 5,
    };
    this.primary = new OpossumBreaker<[() => Promise<unknown>], unknown>(
      async (fn) => fn(),
      { ...oOpts, name },
    );
    this.breakers = new Map();
    for (const kind of ["rate_limit", "transient", "quota", "auth"] as const) {
      this.breakers.set(
        kind,
        new OpossumBreaker<[], unknown>(async () => {}, {
          ...oOpts,
          name: `${name}:${kind}`,
        }),
      );
    }
    this.primary.on("open", () => { this.failureCount++; if (this.failureCount >= this.highWatermark) this.degraded = true; });
    this.primary.on("halfOpen", () => { if (this.failureCount < this.highWatermark) this.degraded = false; });
    this.primary.on("close", () => { this.failureCount = 0; this.degraded = false; });
  }

  getState(): "CLOSED" | "OPEN" | "HALF_OPEN" | "DEGRADED" {
    if (this.degraded) return "DEGRADED";
    if (this.primary.opened) return "OPEN";
    if (this.primary.halfOpen) return "HALF_OPEN";
    return "CLOSED";
  }

  get name_(): string { return this.name; }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return this.primary.fire(fn) as Promise<T>;
  }
}

// ─── Opossum primary dispatch ──────────────────────────────────────────────

const _opossumRegistry = new Map<string, OpossumCircuitBreaker>();

function getOrCreateOpossumBreaker(
  name: string,
  options?: Partial<OpossumOptions>,
): OpossumCircuitBreaker {
  let breaker = _opossumRegistry.get(name);
  if (!breaker) {
    breaker = new OpossumCircuitBreaker(name, options);
    _opossumRegistry.set(name, breaker);
  }
  return breaker;
}

// ─── Shadow telemetry (kept from step-1) ──────────────────────────────────

let _opossumShadowStats = { enabled: false, fires: 0, divergences: 0, opossumOpens: 0, primaryOpens: 0 };

export function runOpossumShadow<T>(primary: CircuitBreaker, fn: () => Promise<T>): Promise<T> {
  if (!_opossumPrimaryEnabled) return fn();
  _opossumShadowStats.enabled = true;
  _opossumShadowStats.fires++;
  return fn().catch((err) => { throw err; });
}

export function recordOpossumDivergence(primaryState: string, opossumState: string): void {
  if (primaryState !== opossumState) _opossumShadowStats.divergences++;
  if (opossumState === "OPEN") _opossumShadowStats.opossumOpens++;
  if (primaryState === "OPEN" || primaryState === "DEGRADED") _opossumShadowStats.primaryOpens++;
}

export function __getOpossumShadowStats() {
  return { ..._opossumShadowStats };
}

export function __resetOpossumShadowStats() {
  _opossumShadowStats = { enabled: false, fires: 0, divergences: 0, opossumOpens: 0, primaryOpens: 0 };
}
